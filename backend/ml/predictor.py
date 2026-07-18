import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, List
from backend.analysis.indicators import enrich_stock_dataframe
from backend.ml.lstm_model import BiLSTMWithAttention

# Device configuration (forces CPU-only to save resources on EC2)
device = torch.device("cpu")

class StockPredictor:
    def __init__(self, window_size: int = 20):
        self.window_size = window_size
        self.model = None
        self.feature_min = None
        self.feature_max = None
        
    def _prepare_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Enriches and formats the stock dataframe into ML sliding windows.
        """
        enriched_df = enrich_stock_dataframe(df)
        closes = enriched_df["close"].values
        
        feature_cols = [
            "rsi", "macd_hist", "volatility", "bb_pct_b",
            "open", "high", "low", "close", "volume",
            "sma_20", "sma_50"
        ]
        
        # Calculate daily log returns
        log_rets = np.log(closes[1:] / closes[:-1])
        
        features_list = []
        labels_list = []
        
        # Start indices past window size
        for i in range(self.window_size, len(log_rets) - 7):
            # Window of log returns
            ret_window = log_rets[i - self.window_size : i]
            
            # Fetch indicator values for the last timestep of the window
            row = enriched_df.iloc[i]
            ind_features = [
                row["rsi"] / 100.0,
                np.tanh(row["macd_hist"] / row["close"] * 100.0),
                np.tanh(row["volatility"] * 10.0),
                row["bb_pct_b"],
                (row["close"] / row["sma_20"]) - 1.0,
                (row["close"] / row["sma_50"]) - 1.0,
            ]
            
            # Combine 10 historical daily returns + technical indicators
            # Total dimension: 10 returns + 6 indicators = 16 features
            recent_rets = list(ret_window[-10:])
            while len(recent_rets) < 10:
                recent_rets.append(0.0) # padding if window is small
                
            f = recent_rets + ind_features
            
            # Label is the future 7-day cumulative return
            future_price = closes[i + 7]
            curr_price = closes[i]
            label = (future_price / curr_price) - 1.0
            
            features_list.append(f)
            labels_list.append(label)
            
        return np.array(features_list), np.array(labels_list), feature_cols

    def train_model(self, df: pd.DataFrame, ticker: str, epochs: int = 50, callback = None) -> Dict[str, Any]:
        """
        Trains the PyTorch BiLSTM model on the historical stock dataframe.
        """
        X, y, _ = self._prepare_data(df)
        if len(X) < 30:
            raise ValueError(f"Insufficient training samples ({len(X)}) for {ticker}. Needs at least 30 samples after window cuts.")
            
        # Fit Min-Max scaler parameters
        self.feature_min = X.min(axis=0)
        self.feature_max = X.max(axis=0)
        
        # Avoid division by zero
        ranges = self.feature_max - self.feature_min
        ranges[ranges < 1e-8] = 1.0
        
        # Normalize features
        X_norm = (X - self.feature_min) / ranges
        
        # 80/20 train/validation split
        split_idx = int(len(X_norm) * 0.8)
        
        X_train, X_val = X_norm[:split_idx], X_norm[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Convert to PyTorch tensors
        # LSTM input shape: [batch, sequence_length, input_dim]
        # We treat the feature vectors as a 1D sequence of length 1 (no timestep dimension needed since history is flattened)
        # Or, we can reshape it to [batch, 1, input_dim]
        x_tr_tensor = torch.tensor(X_train, dtype=torch.float32).unsqueeze(1).to(device)
        y_tr_tensor = torch.tensor(y_train, dtype=torch.float32).to(device)
        x_val_tensor = torch.tensor(X_val, dtype=torch.float32).unsqueeze(1).to(device)
        y_val_tensor = torch.tensor(y_val, dtype=torch.float32).to(device)
        
        input_dim = X.shape[1]
        self.model = BiLSTMWithAttention(input_dim=input_dim).to(device)
        
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.002, weight_decay=1e-5)
        
        loss_hist = []
        val_loss_hist = []
        
        for epoch in range(1, epochs + 1):
            self.model.train()
            optimizer.zero_grad()
            
            preds = self.model(x_tr_tensor)
            loss = criterion(preds, y_tr_tensor)
            loss.backward()
            optimizer.step()
            
            # Validation loop
            self.model.eval()
            with torch.no_grad():
                val_preds = self.model(x_val_tensor)
                val_loss = criterion(val_preds, y_val_tensor)
                
            loss_val = float(loss.item())
            val_loss_val = float(val_loss.item())
            loss_hist.append(loss_val)
            val_loss_hist.append(val_loss_val)
            
            if callback:
                callback(epoch, epochs, loss_val, val_loss_val)
                
        # Evaluate model directional accuracy
        self.model.eval()
        with torch.no_grad():
            final_val_preds = self.model(x_val_tensor).numpy()
            
        correct_directions = np.sum(np.sign(final_val_preds) == np.sign(y_val))
        dir_acc = float(correct_directions / len(y_val))
        
        # Save model parameters
        os.makedirs("backend/ml/saved_models", exist_ok=True)
        save_path = f"backend/ml/saved_models/{ticker}.pt"
        torch.save({
            "model_state": self.model.state_dict(),
            "feature_min": self.feature_min,
            "feature_max": self.feature_max,
            "window_size": self.window_size,
            "input_dim": input_dim
        }, save_path)
        
        return {
            "train_loss": loss_hist[-1],
            "val_loss": val_loss_hist[-1],
            "dir_accuracy": dir_acc,
            "loss_history": loss_hist,
            "val_loss_history": val_loss_hist
        }

    def load_and_predict(self, df: pd.DataFrame, ticker: str) -> float:
        """
        Loads the trained model weights and returns the 7-day expected return.
        """
        save_path = f"backend/ml/saved_models/{ticker}.pt"
        if not os.path.exists(save_path):
            raise FileNotFoundError(f"No trained model found for ticker: {ticker}. Train it first.")
            
        checkpoint = torch.load(save_path, map_location=device)
        self.window_size = checkpoint["window_size"]
        input_dim = checkpoint["input_dim"]
        self.feature_min = checkpoint["feature_min"]
        self.feature_max = checkpoint["feature_max"]
        
        self.model = BiLSTMWithAttention(input_dim=input_dim).to(device)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        
        # Prepare latest feature window
        X, _, _ = self._prepare_data(df)
        latest_feature = X[-1] # latest day's features
        
        # Normalize feature using saved parameters
        ranges = self.feature_max - self.feature_min
        ranges[ranges < 1e-8] = 1.0
        latest_norm = (latest_feature - self.feature_min) / ranges
        
        latest_tensor = torch.tensor(latest_norm, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(device)
        with torch.no_grad():
            pred_return = float(self.model(latest_tensor).item())
            
        return pred_return
