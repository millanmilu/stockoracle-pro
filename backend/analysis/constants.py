"""
StockOracle Pro — Technical Indicator Constants
Centralized constants for default periods, multipliers, and threshold parameters.
"""

# Moving Averages
DEFAULT_SMA_20: int = 20
DEFAULT_SMA_50: int = 50
DEFAULT_SMA_200: int = 200
DEFAULT_EMA_9: int = 9
DEFAULT_EMA_12: int = 12
DEFAULT_EMA_21: int = 21
DEFAULT_EMA_26: int = 26

# Backward-compatibility aliases
SMA_20: int = 20
SMA_50: int = 50
SMA_200: int = 200
EMA_9: int = 9
EMA_12: int = 12
EMA_21: int = 21
EMA_26: int = 26

# RSI & Momentum
DEFAULT_RSI_PERIOD: int = 14
DEFAULT_RSI_NEUTRAL: float = 50.0
RSI_PERIOD: int = 14

# MACD
DEFAULT_MACD_FAST: int = 12
DEFAULT_MACD_SLOW: int = 26
DEFAULT_MACD_SIGNAL: int = 9
MACD_FAST: int = 12
MACD_SLOW: int = 26
MACD_SIGNAL: int = 9

# Bollinger Bands
DEFAULT_BB_PERIOD: int = 20
DEFAULT_BB_STD: float = 2.0
BB_PERIOD: int = 20

# Volatility & ATR / ADX
DEFAULT_ATR_PERIOD: int = 14
DEFAULT_ADX_PERIOD: int = 14
ATR_PERIOD: int = 14
ADX_PERIOD: int = 14

# Supertrend
DEFAULT_SUPERTREND_PERIOD: int = 10
DEFAULT_SUPERTREND_MULTIPLIER: float = 3.0

# Oscillators & Momentum
DEFAULT_STOCH_K_PERIOD: int = 14
DEFAULT_STOCH_D_PERIOD: int = 3
DEFAULT_CCI_PERIOD: int = 20
DEFAULT_WILLIAMS_R_PERIOD: int = 14
DEFAULT_ROC_PERIOD: int = 12
DEFAULT_MFI_PERIOD: int = 14

STOCH_K_PERIOD: int = 14
STOCH_D_PERIOD: int = 3
CCI_PERIOD: int = 20
WILLIAMS_R_PERIOD: int = 14
MFI_PERIOD: int = 14

# Keltner & Donchian Channels
DEFAULT_KELTNER_EMA_PERIOD: int = 20
DEFAULT_KELTNER_ATR_PERIOD: int = 10
DEFAULT_KELTNER_MULTIPLIER: float = 2.0
DEFAULT_DONCHIAN_PERIOD: int = 20

# Ichimoku Cloud
DEFAULT_ICHIMOKU_TENKAN: int = 9
DEFAULT_ICHIMOKU_KIJUN: int = 26
DEFAULT_ICHIMOKU_SENKOU_B: int = 52
DEFAULT_ICHIMOKU_DISPLACEMENT: int = 26

# Fibonacci
DEFAULT_FIBONACCI_PERIOD: int = 50

# Cache Limits
INDICATOR_CACHE_MAX_ENTRIES: int = 128
