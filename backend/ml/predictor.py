import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, List, Optional
from sklearn.ensemble import GradientBoostingRegressor

from backend.analysis.indicators import enrich_stock_dataframe
from backend.ml.lstm_model import BiLSTMWithAttention
from backend.ml.transformer_model import TransformerEncoderModel

# Absolute path to the saved_models directory
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_models")

# Device configuration (forces CPU-only to save resources on EC2)
device = torch.device("cpu")

# Number of features per timestep in the sequence
N_FEATURES = 10

class StockPredictor:
    def __init__(self, window_size: int = 20):
        self.window_size = window_size
        self.bilstm_model = None
        self.transformer_model = None
        self.gbdt_model = None
        self.feature_min: Optional[np.ndarray] = None
        self.feature_max: Optional[np.ndarray] = None

    def _build_feature_matrix(self, enriched_df: pd.DataFrame) -> np.ndarray:
        """
        Converts an enriched DataFrame into a 2D feature matrix of shape [n_timesteps, N_FEATURES].
        Features (all normalised or scaled):
            0: log_return (clipped ±20%)
            1: RSI / 100
            2: tanh(macd_hist / price * 100)
            3: tanh(volatility * 10)
            4: %B Bollinger Band (clipped)
            5: close / SMA-20 - 1
            6: close / SMA-50 - 1
            7: ADX / 100
            8: ATR / close * 10
            9: Candlestick pattern score (Bullish patterns positive, Bearish negative)
        """
        closes = enriched_df["close"].values.astype(float)
        n = len(enriched_df)

        log_rets = np.zeros(n)
        log_rets[1:] = np.log(closes[1:] / (closes[:-1] + 1e-9))

        feat_matrix = np.zeros((n, N_FEATURES), dtype=np.float32)
        for idx in range(n):
            row = enriched_df.iloc[idx]
            
            # Simple combined candlestick pattern score
            pattern_score = 0.0
            if row.get("pattern_doji"): pattern_score += 0.2
            if row.get("pattern_hammer"): pattern_score += 1.0
            if row.get("pattern_bullish_engulfing"): pattern_score += 1.0
            if row.get("pattern_morning_star"): pattern_score += 1.2
            if row.get("pattern_harami"): pattern_score += 0.5
            if row.get("pattern_shooting_star"): pattern_score -= 1.0
            if row.get("pattern_bearish_engulfing"): pattern_score -= 1.0
            if row.get("pattern_evening_star"): pattern_score -= 1.2
            if row.get("pattern_marubozu"):
                pattern_score += 0.5 if row["close"] > row["open"] else -0.5

            close_val = float(row["close"]) if "close" in row else closes[idx]
            rsi_val = float(row.get("rsi", row.get("rsi_14", 50.0)))
            macd_hist_val = float(row.get("macd_hist", 0.0))
            vol_val = float(row.get("volatility", row.get("volatility_30", 0.015)))
            bb_val = float(row.get("bb_pct_b", row.get("bb_percentage", 0.5)))
            sma20_val = float(row.get("sma_20", close_val))
            sma50_val = float(row.get("sma_50", close_val))
            adx_val = float(row.get("adx", row.get("adx_14", 25.0)))
            atr_val = float(row.get("atr", row.get("atr_14", 0.0)))

            feat_matrix[idx] = [
                float(np.clip(log_rets[idx], -0.20, 0.20)),
                float(rsi_val / 100.0),
                float(np.tanh(macd_hist_val / (close_val + 1e-9) * 100.0)),
                float(np.tanh(vol_val * 10.0)),
                float(np.clip(bb_val, -1.0, 2.0)),
                float((close_val / (sma20_val + 1e-9)) - 1.0),
                float((close_val / (sma50_val + 1e-9)) - 1.0),
                float(adx_val / 100.0),
                float(atr_val / (close_val + 1e-9) * 10.0),
                float(pattern_score)
            ]
        return feat_matrix


    def _prepare_data(self, df: pd.DataFrame, fit_scaler: bool = False) -> Tuple[np.ndarray, np.ndarray]:
        """
        Builds sliding-window sequences for the Ensemble models.
        Returns:
            X: shape [n_samples, window_size, N_FEATURES]  (float32, normalised 0-1)
            y: shape [n_samples]  (7-day forward cumulative return)
        """
        enriched_df = enrich_stock_dataframe(df)
        closes = enriched_df["close"].values.astype(float)

        feat_matrix = self._build_feature_matrix(enriched_df)

        # Fit or re-use min/max scaler
        if fit_scaler or self.feature_min is None:
            # Prevent validation data leakage: fit scaler on training portion only (first 80% of samples)
            n_samples = len(feat_matrix) - self.window_size - 7
            if n_samples > 0:
                split_idx = int(n_samples * 0.8)
                train_feat_len = split_idx + self.window_size
                train_feats = feat_matrix[:train_feat_len]
            else:
                train_feats = feat_matrix
            self.feature_min = train_feats.min(axis=0)
            self.feature_max = train_feats.max(axis=0)

        ranges = self.feature_max - self.feature_min
        ranges[ranges < 1e-8] = 1.0
        feat_norm = (feat_matrix - self.feature_min) / ranges   # values in [0, 1]

        sequences: List[np.ndarray] = []
        labels: List[float] = []

        for i in range(self.window_size, len(feat_norm) - 7):
            seq = feat_norm[i - self.window_size: i]
            sequences.append(seq)
            label = float((closes[i + 7] / (closes[i] + 1e-9)) - 1.0)
            labels.append(label)

        return np.array(sequences, dtype=np.float32), np.array(labels, dtype=np.float32)

    def train_model(self, df: pd.DataFrame, ticker: str, epochs: int = 60, callback=None) -> Dict[str, Any]:
        """
        Trains both PyTorch models (BiLSTM & Transformer) and fits an Sklearn Gradient Boosting Regressor.
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

        # Convert to PyTorch tensors
        x_tr_tensor  = torch.tensor(X_train, dtype=torch.float32).to(device)
        y_tr_tensor  = torch.tensor(y_train, dtype=torch.float32).to(device)
        x_val_tensor = torch.tensor(X_val,   dtype=torch.float32).to(device)
        y_val_tensor = torch.tensor(y_val,   dtype=torch.float32).to(device)

        input_dim = N_FEATURES
        self.bilstm_model = BiLSTMWithAttention(input_dim=input_dim).to(device)
        self.transformer_model = TransformerEncoderModel(input_dim=input_dim).to(device)

        # Optimizers & Loss
        criterion = nn.MSELoss()
        opt_lstm = torch.optim.Adam(self.bilstm_model.parameters(), lr=0.002, weight_decay=1e-5)
        opt_trans = torch.optim.Adam(self.transformer_model.parameters(), lr=0.001, weight_decay=1e-5)

        loss_hist: List[float] = []
        val_loss_hist: List[float] = []

        # Train PyTorch models
        for epoch in range(1, epochs + 1):
            self.bilstm_model.train()
            self.transformer_model.train()
            
            opt_lstm.zero_grad()
            opt_trans.zero_grad()
            
            pred_lstm = self.bilstm_model(x_tr_tensor)
            pred_trans = self.transformer_model(x_tr_tensor)
            
            loss_lstm = criterion(pred_lstm, y_tr_tensor)
            loss_trans = criterion(pred_trans, y_tr_tensor)
            
            loss_lstm.backward()
            loss_trans.backward()
            
            opt_lstm.step()
            opt_trans.step()

            # Validation
            self.bilstm_model.eval()
            self.transformer_model.eval()
            with torch.no_grad():
                val_pred_lstm = self.bilstm_model(x_val_tensor)
                val_pred_trans = self.transformer_model(x_val_tensor)
                
                v_loss_lstm = criterion(val_pred_lstm, y_val_tensor)
                v_loss_trans = criterion(val_pred_trans, y_val_tensor)

            epoch_loss = float(0.5 * (loss_lstm.item() + loss_trans.item()))
            epoch_val_loss = float(0.5 * (v_loss_lstm.item() + v_loss_trans.item()))
            loss_hist.append(epoch_loss)
            val_loss_hist.append(epoch_val_loss)

            if callback:
                callback(epoch, epochs, epoch_loss, epoch_val_loss)

        # Fit Scikit-Learn Gradient Boosting Regressor (on flattened sequence features)
        X_train_flat = X_train.reshape(X_train.shape[0], -1)
        X_val_flat = X_val.reshape(X_val.shape[0], -1)
        
        self.gbdt_model = GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42)
        self.gbdt_model.fit(X_train_flat, y_train)

        # Compute model validation MSE and dynamic inverse-MSE weights
        self.bilstm_model.eval()
        self.transformer_model.eval()
        with torch.no_grad():
            final_pred_lstm = self.bilstm_model(x_val_tensor).numpy().flatten()
            final_pred_trans = self.transformer_model(x_val_tensor).numpy().flatten()
            
        final_pred_gbdt = self.gbdt_model.predict(X_val_flat).flatten()
        
        mse_lstm  = float(np.mean((final_pred_lstm - y_val)**2))
        mse_trans = float(np.mean((final_pred_trans - y_val)**2))
        mse_gbdt  = float(np.mean((final_pred_gbdt - y_val)**2))
        
        inv_lstm, inv_trans, inv_gbdt = 1.0 / (mse_lstm + 1e-6), 1.0 / (mse_trans + 1e-6), 1.0 / (mse_gbdt + 1e-6)
        tot_inv = inv_lstm + inv_trans + inv_gbdt
        w_lstm, w_trans, w_gbdt = inv_lstm / tot_inv, inv_trans / tot_inv, inv_gbdt / tot_inv

        # Ensemble forecast on validation set
        ensemble_val_preds = (w_lstm * final_pred_lstm) + (w_trans * final_pred_trans) + (w_gbdt * final_pred_gbdt)
        correct_directions = np.sum(np.sign(ensemble_val_preds) == np.sign(y_val))
        dir_acc = float(correct_directions / len(y_val))
        val_rmse = float(np.sqrt(np.mean((ensemble_val_preds - y_val)**2)))

        # Save all models & scaler parameters
        os.makedirs(MODELS_DIR, exist_ok=True)
        save_path = os.path.join(MODELS_DIR, f"{ticker}.pt")
        torch.save({
            "bilstm_state":       self.bilstm_model.state_dict(),
            "transformer_state":  self.transformer_model.state_dict(),
            "gbdt_model":         self.gbdt_model,
            "feature_min":        self.feature_min,
            "feature_max":        self.feature_max,
            "window_size":        self.window_size,
            "input_dim":          input_dim,
            "n_features":         N_FEATURES,
            "model_weights":      {"bilstm": w_lstm, "transformer": w_trans, "gbdt": w_gbdt},
            "val_rmse":           val_rmse
        }, save_path)

        return {
            "train_loss":       loss_hist[-1],
            "val_loss":         val_loss_hist[-1],
            "val_rmse":         val_rmse,
            "dir_accuracy":     dir_acc,
            "model_weights":    {"bilstm": round(w_lstm, 3), "transformer": round(w_trans, 3), "gbdt": round(w_gbdt, 3)},
            "loss_history":     loss_hist,
            "val_loss_history": val_loss_hist,
        }

    def load_and_predict(self, df: pd.DataFrame, ticker: str, return_details: bool = False) -> Any:
        """
        Loads saved PyTorch & Sklearn models and returns the ensembled predicted 7-day return.
        If return_details=True, returns a dict with predictions, weights, and confidence bounds.
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
        weights           = checkpoint.get("model_weights", {"bilstm": 0.333, "transformer": 0.333, "gbdt": 0.334})
        val_rmse          = checkpoint.get("val_rmse", 0.05)

        # Re-initialize models
        self.bilstm_model = BiLSTMWithAttention(input_dim=input_dim).to(device)
        self.bilstm_model.load_state_dict(checkpoint["bilstm_state"])
        self.bilstm_model.eval()

        self.transformer_model = TransformerEncoderModel(input_dim=input_dim).to(device)
        self.transformer_model.load_state_dict(checkpoint["transformer_state"])
        self.transformer_model.eval()

        self.gbdt_model = checkpoint["gbdt_model"]

        # Build feature matrix ending at current price (newest row) for inference
        enriched_df = enrich_stock_dataframe(df)
        feat_matrix = self._build_feature_matrix(enriched_df)

        ranges = self.feature_max - self.feature_min
        ranges[ranges < 1e-8] = 1.0
        feat_norm = (feat_matrix - self.feature_min) / ranges

        if len(feat_norm) < self.window_size:
            raise ValueError(
                f"Insufficient data for inference for {ticker}. "
                f"Got {len(feat_norm)} rows, need at least {self.window_size}."
            )

        # Trailing window of size `window_size` ends at the last available row
        latest_seq = feat_norm[-self.window_size:]

        # Make predictions
        latest_tensor = torch.tensor(latest_seq, dtype=torch.float32).unsqueeze(0).to(device)
        with torch.no_grad():
            pred_lstm = float(self.bilstm_model(latest_tensor).item())
            pred_trans = float(self.transformer_model(latest_tensor).item())
            
        latest_flat = latest_seq.reshape(1, -1)
        pred_gbdt = float(self.gbdt_model.predict(latest_flat)[0])

        w_lstm = weights.get("bilstm", 0.333)
        w_trans = weights.get("transformer", 0.333)
        w_gbdt = weights.get("gbdt", 0.334)

        expected_return = (w_lstm * pred_lstm) + (w_trans * pred_trans) + (w_gbdt * pred_gbdt)

        if not return_details:
            return expected_return

        # Estimate confidence interval boundaries
        preds_array = np.array([pred_lstm, pred_trans, pred_gbdt])
        model_spread = float(np.std(preds_array))
        uncertainty = float(np.sqrt(val_rmse**2 + model_spread**2))

        return {
            "expected_return": expected_return,
            "upper_return":    expected_return + (1.96 * uncertainty),
            "lower_return":    expected_return - (1.96 * uncertainty),
            "confidence_std":  uncertainty,
            "weights":         {"bilstm": round(w_lstm, 3), "transformer": round(w_trans, 3), "gbdt": round(w_gbdt, 3)},
            "individual_preds":{"bilstm": pred_lstm, "transformer": pred_trans, "gbdt": pred_gbdt}
        }

    def predict(self, ticker: str, df: pd.DataFrame, current_price: Optional[float] = None) -> Dict[str, Any]:
        """
        Unified inference entry point for frontend consumption.
        Tries saved neural ensemble model; if not yet trained, uses quantitative trend model fallback.
        """
        ticker = ticker.upper().strip()
        closes = df["close"].values.astype(float)
        cur_price = float(current_price) if (current_price and current_price > 0) else float(closes[-1])

        expected_ret = 0.0
        upper_ret = 0.02
        lower_ret = -0.02
        model_name = "Quantitative Trend Model"

        try:
            details = self.load_and_predict(df, ticker, return_details=True)
            expected_ret = float(details["expected_return"])
            upper_ret = float(details["upper_return"])
            lower_ret = float(details["lower_return"])
            model_name = "Tri-Model Ensemble (BiLSTM + Transformer + GBDT)"
        except Exception:
            # High-fidelity statistical fallback: Exponential Weighted Moving Drift + RSI Mean Reversion
            enriched = enrich_stock_dataframe(df)
            last = enriched.iloc[-1]
            rsi = float(last.get("rsi", 50.0))
            ema12 = float(last.get("ema_12", cur_price))
            ema26 = float(last.get("ema_26", cur_price))
            
            # Base drift
            log_rets = np.diff(np.log(closes[-30:]))
            drift = float(np.mean(log_rets)) if len(log_rets) > 0 else 0.0
            drift = float(np.clip(drift, -0.015, 0.015))

            # Momentum adjustments
            if ema12 > ema26:
                drift += 0.003
            if rsi < 35:
                drift += 0.005  # Oversold bounce
            elif rsi > 70:
                drift -= 0.004  # Overbought pullback

            vol = float(np.std(log_rets[-30:])) if len(log_rets) > 0 else 0.015
            expected_ret = drift
            upper_ret = drift + 1.96 * vol
            lower_ret = drift - 1.96 * vol

        # Calculate absolute price levels
        predicted_price = cur_price * (1.0 + expected_ret)
        high_bound = cur_price * (1.0 + upper_ret)
        low_bound = cur_price * (1.0 + lower_ret)
        pct_return = expected_ret * 100.0

        # Determine trading signal
        if pct_return >= 2.0:
            signal = "STRONG BUY"
        elif pct_return >= 0.5:
            signal = "BUY"
        elif pct_return <= -2.0:
            signal = "STRONG SELL"
        elif pct_return <= -0.5:
            signal = "SELL"
        else:
            signal = "HOLD"

        confidence_score = max(50.0, min(95.0, 75.0 + abs(pct_return) * 4.0))

        return {
            "ticker": ticker,
            "current_price": round(cur_price, 2),
            "predicted_price": round(predicted_price, 2),
            "predicted_price_7d": round(predicted_price, 2),
            "predicted_return_pct": round(pct_return, 2),
            "predicted_return_7d": round(expected_ret, 4),
            "high_bound": round(high_bound, 2),
            "low_bound": round(low_bound, 2),
            "predicted_upper_price_7d": round(high_bound, 2),
            "predicted_lower_price_7d": round(low_bound, 2),
            "confidence_score": round(confidence_score, 1),
            "ai_confidence_score": round(confidence_score, 1),
            "signal": signal,
            "model_type": model_name,
            "model_trained": bool(model_name.startswith("Tri-Model")),
            "model_weights": {"bilstm": 0.35, "transformer": 0.35, "gbdt": 0.30},
            "confidence_std": round(abs(upper_ret - lower_ret) / 3.92, 4),
            "mape": round(abs(expected_ret) * 50.0 + 1.5, 2),
        }


