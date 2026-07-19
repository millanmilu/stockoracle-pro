import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, List, Optional
from backend.analysis.indicators import enrich_stock_dataframe
from backend.ml.lstm_model import BiLSTMWithAttention

# Absolute path to the saved_models directory (works regardless of cwd)
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_models")

# Device configuration (forces CPU-only to save resources on EC2)
device = torch.device("cpu")

# Number of features per timestep in the sequence
N_FEATURES = 7

class StockPredictor:
    def __init__(self, window_size: int = 20):
        self.window_size = window_size
        self.model = None
        self.feature_min: Optional[np.ndarray] = None
        self.feature_max: Optional[np.ndarray] = None

    def _build_feature_matrix(self, enriched_df: pd.DataFrame) -> np.ndarray:
        """
        Converts an enriched DataFrame into a 2D feature matrix of shape [n_timesteps, N_FEATURES].
        Features (all normalised to roughly [-1, 1]):
            0: log_return (clipped ±20%)
            1: RSI / 100
            2: tanh(macd_hist / price * 100)
            3: tanh(volatility * 10)
            4: %B Bollinger Band (clipped)
            5: close / SMA-20  − 1
            6: close / SMA-50  − 1
        """
        closes = enriched_df["close"].values.astype(float)
        n = len(enriched_df)

        log_rets = np.zeros(n)
        log_rets[1:] = np.log(closes[1:] / (closes[:-1] + 1e-9))

        feat_matrix = np.zeros((n, N_FEATURES), dtype=np.float32)
        for idx in range(n):
            row = enriched_df.iloc[idx]
            feat_matrix[idx] = [
                float(np.clip(log_rets[idx], -0.20, 0.20)),
                float(row["rsi"] / 100.0),
                float(np.tanh(row["macd_hist"] / (row["close"] + 1e-9) * 100.0)),
                float(np.tanh(row["volatility"] * 10.0)),
                float(np.clip(row["bb_pct_b"], -1.0, 2.0)),
                float((row["close"] / (row["sma_20"] + 1e-9)) - 1.0),
                float((row["close"] / (row["sma_50"] + 1e-9)) - 1.0),
            ]
        return feat_matrix

    def _prepare_data(self, df: pd.DataFrame, fit_scaler: bool = False) -> Tuple[np.ndarray, np.ndarray]:
        """
        Builds sliding-window sequences for the BiLSTM.

        Returns:
            X: shape [n_samples, window_size, N_FEATURES]  (float32, normalised 0-1)
            y: shape [n_samples]  (7-day forward cumulative return)
        """
        enriched_df = enrich_stock_dataframe(df)
        closes = enriched_df["close"].values.astype(float)

        feat_matrix = self._build_feature_matrix(enriched_df)

        # Fit or re-use min/max scaler
        if fit_scaler or self.feature_min is None:
            self.feature_min = feat_matrix.min(axis=0)
            self.feature_max = feat_matrix.max(axis=0)

        ranges = self.feature_max - self.feature_min
        ranges[ranges < 1e-8] = 1.0
        feat_norm = (feat_matrix - self.feature_min) / ranges   # values in [0, 1]

        sequences: List[np.ndarray] = []
        labels: List[float] = []

        for i in range(self.window_size, len(feat_norm) - 7):
            # Sequence of window_size timesteps → shape [window_size, N_FEATURES]
            seq = feat_norm[i - self.window_size: i]
            sequences.append(seq)

            # Label: 7-day forward cumulative return
            label = float((closes[i + 7] / (closes[i] + 1e-9)) - 1.0)
            labels.append(label)

        return np.array(sequences, dtype=np.float32), np.array(labels, dtype=np.float32)

    def train_model(self, df: pd.DataFrame, ticker: str, epochs: int = 60, callback=None) -> Dict[str, Any]:
        """
        Trains the PyTorch BiLSTM + Attention model on proper time-series windows.
        Input to model: [batch, window_size, N_FEATURES]
        """
        X, y = self._prepare_data(df, fit_scaler=True)

        if len(X) < 30:
            raise ValueError(
                f"Insufficient training samples ({len(X)}) for {ticker}. "
                "Needs at least 30 samples after window cuts."
            )

        # 80/20 train/validation split (time-ordered — no shuffle)
        split_idx = int(len(X) * 0.8)
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]

        # X is already [n, window_size, N_FEATURES] — pass directly to LSTM
        x_tr_tensor  = torch.tensor(X_train, dtype=torch.float32).to(device)
        y_tr_tensor  = torch.tensor(y_train, dtype=torch.float32).to(device)
        x_val_tensor = torch.tensor(X_val,   dtype=torch.float32).to(device)
        y_val_tensor = torch.tensor(y_val,   dtype=torch.float32).to(device)

        input_dim = N_FEATURES
        self.model = BiLSTMWithAttention(input_dim=input_dim).to(device)

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.002, weight_decay=1e-5)

        loss_hist:     List[float] = []
        val_loss_hist: List[float] = []

        for epoch in range(1, epochs + 1):
            self.model.train()
            optimizer.zero_grad()
            preds = self.model(x_tr_tensor)
            loss  = criterion(preds, y_tr_tensor)
            loss.backward()
            optimizer.step()

            self.model.eval()
            with torch.no_grad():
                val_preds = self.model(x_val_tensor)
                val_loss  = criterion(val_preds, y_val_tensor)

            loss_val     = float(loss.item())
            val_loss_val = float(val_loss.item())
            loss_hist.append(loss_val)
            val_loss_hist.append(val_loss_val)

            if callback:
                callback(epoch, epochs, loss_val, val_loss_val)

        # Directional accuracy on validation set
        self.model.eval()
        with torch.no_grad():
            final_val_preds = self.model(x_val_tensor).numpy()

        correct_directions = np.sum(np.sign(final_val_preds) == np.sign(y_val))
        dir_acc = float(correct_directions / len(y_val))

        # Save model with scaler parameters
        os.makedirs(MODELS_DIR, exist_ok=True)
        save_path = os.path.join(MODELS_DIR, f"{ticker}.pt")
        torch.save({
            "model_state":  self.model.state_dict(),
            "feature_min":  self.feature_min,
            "feature_max":  self.feature_max,
            "window_size":  self.window_size,
            "input_dim":    input_dim,
            "n_features":   N_FEATURES,
        }, save_path)

        return {
            "train_loss":       loss_hist[-1],
            "val_loss":         val_loss_hist[-1],
            "dir_accuracy":     dir_acc,
            "loss_history":     loss_hist,
            "val_loss_history": val_loss_hist,
        }

    def load_and_predict(self, df: pd.DataFrame, ticker: str) -> float:
        """
        Loads saved model weights and returns the predicted 7-day forward return.
        """
        save_path = os.path.join(MODELS_DIR, f"{ticker}.pt")
        if not os.path.exists(save_path):
            raise FileNotFoundError(
                f"No trained model found for ticker: {ticker}. Train it first."
            )

        checkpoint = torch.load(save_path, map_location=device)
        self.window_size  = checkpoint["window_size"]
        self.feature_min  = checkpoint["feature_min"]
        self.feature_max  = checkpoint["feature_max"]
        input_dim         = checkpoint["input_dim"]

        self.model = BiLSTMWithAttention(input_dim=input_dim).to(device)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()

        # Build normalised sequences using saved scaler (fit_scaler=False)
        X, _ = self._prepare_data(df, fit_scaler=False)
        latest_seq = X[-1]   # shape [window_size, N_FEATURES]

        # Add batch dimension → [1, window_size, N_FEATURES]
        latest_tensor = torch.tensor(latest_seq, dtype=torch.float32).unsqueeze(0).to(device)
        with torch.no_grad():
            pred_return = float(self.model(latest_tensor).item())

        return pred_return
