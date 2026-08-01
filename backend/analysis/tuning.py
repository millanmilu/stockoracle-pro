import pandas as pd
import numpy as np
from sklearn.model_selection import RandomizedSearchCV
import xgboost as xgb

def tune_xgboost(X: pd.DataFrame, y: pd.Series) -> dict:
    """
    Performs a RandomizedSearchCV on an XGBoost Regressor with 10 iterations and 3-fold CV.
    Tunes max_depth, learning_rate, and subsample.
    """
    # Define the parameter grid
    param_dist = {
        'max_depth': np.arange(3, 11),  # 3 to 10
        'learning_rate': np.linspace(0.01, 0.3, 30),
        'subsample': np.linspace(0.6, 1.0, 10)
    }
    
    # Initialize the base model
    # Using n_estimators=100 for speed as requested (lightweight)
    base_model = xgb.XGBRegressor(n_estimators=100, objective='reg:squarederror', random_state=42)
    
    # Setup RandomizedSearchCV (lightweight: 5 iterations, 2-fold CV, n_jobs=1 for CPU safety)
    random_search = RandomizedSearchCV(
        estimator=base_model,
        param_distributions=param_dist,
        n_iter=5,
        cv=2,
        scoring='neg_mean_absolute_error',
        n_jobs=1,  # Safe CPU utilization
        random_state=42,
        verbose=0
    )
    
    try:
        random_search.fit(X, y)
        return random_search.best_params_
    except Exception as e:
        print(f"⚠️ Hyperparameter tuning failed ({e}) — falling back to default XGBoost parameters.")
        return {'max_depth': 6, 'learning_rate': 0.1, 'subsample': 0.8}
