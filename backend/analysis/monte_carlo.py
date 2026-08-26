import numpy as np
from typing import Dict, Any, List

def run_monte_carlo_simulation(prices: Any, simulations: int = 150, horizon: int = 30) -> Dict[str, Any]:
    """
    Simulates stock price paths using Geometric Brownian Motion (GBM).
    Accepts DataFrame, Series, or List of float prices.
    """
    import pandas as pd
    if isinstance(prices, pd.DataFrame):
        prices = prices["close"].values.astype(float)
    elif isinstance(prices, pd.Series):
        prices = prices.values.astype(float)
    elif not isinstance(prices, np.ndarray):
        prices = np.array(prices, dtype=float)

    if len(prices) < 2:
        return {}

    returns = np.log(prices[1:] / (prices[:-1] + 1e-9))

    
    # Estimate drift (mu) and volatility (sigma) from historical returns
    mu = np.mean(returns)
    sigma = np.std(returns)
    
    # Fallback for stable assets
    if sigma < 1e-8:
        sigma = 0.01
        
    S0 = prices[-1]
    
    # Initialize array to store simulated paths
    # Dimension: (simulations, horizon + 1)
    paths = np.zeros((simulations, horizon + 1))
    paths[:, 0] = S0
    
    # Vectorized GBM simulation
    for t in range(1, horizon + 1):
        z = np.random.normal(size=simulations)
        paths[:, t] = paths[:, t-1] * np.exp((mu - 0.5 * sigma**2) + sigma * z)
        
    # Calculate percentiles at each timestep
    p10 = []
    p25 = []
    p50 = []
    p75 = []
    p90 = []
    
    for t in range(horizon + 1):
        sorted_vals = np.sort(paths[:, t])
        p10.append(float(sorted_vals[int(simulations * 0.10)]))
        p25.append(float(sorted_vals[int(simulations * 0.25)]))
        p50.append(float(sorted_vals[int(simulations * 0.50)]))
        p75.append(float(sorted_vals[int(simulations * 0.75)]))
        p90.append(float(sorted_vals[int(simulations * 0.90)]))
        
    # Risk Metrics at the terminal day
    final_prices = paths[:, -1]
    prob_up = float(np.sum(final_prices > S0) / simulations)
    
    # VaR 95%: the 5th percentile price drop
    sorted_final = np.sort(final_prices)
    var_95_price = sorted_final[int(simulations * 0.05)]
    var_95_drawdown = float(S0 - var_95_price)
    
    # CVaR 95% (Expected Shortfall): average of worst 5% outcomes
    cvar_95_drawdown = float(S0 - np.mean(sorted_final[:int(simulations * 0.05)]))
    
    expected_return = float((np.mean(final_prices) - S0) / S0)
    
    return {
        "p10": p10,
        "p25": p25,
        "p50": p50,
        "p75": p75,
        "p90": p90,
        "prob_up": prob_up,
        "var_95": var_95_drawdown,
        "cvar_95": cvar_95_drawdown,
        "expected_return": expected_return,
        "current_price": float(S0),
        "horizon": horizon
    }
