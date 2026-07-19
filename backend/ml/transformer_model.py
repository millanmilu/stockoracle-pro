import math
import torch
import torch.nn as nn

class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 100):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        
        # Ensure correct sizing for odd/even dimensions
        pe_sin = torch.sin(position * div_term)
        pe_cos = torch.cos(position * div_term)
        
        pe[:, 0::2] = pe_sin[:, :pe[:, 0::2].size(1)]
        pe[:, 1::2] = pe_cos[:, :pe[:, 1::2].size(1)]
        
        pe = pe.unsqueeze(0)  # [1, max_len, d_model]
        self.register_buffer('pe', pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, :x.size(1)]

class TransformerEncoderModel(nn.Module):
    def __init__(self, input_dim: int, d_model: int = 32, nhead: int = 4, num_layers: int = 2, dim_feedforward: int = 64, max_len: int = 100):
        super().__init__()
        self.input_projection = nn.Linear(input_dim, d_model)
        self.pos_encoder = PositionalEncoding(d_model, max_len)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=0.1,
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        self.fc = nn.Sequential(
            nn.Linear(d_model, 16),
            nn.ReLU(),
            nn.Linear(16, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Input shape: [batch_size, seq_len, input_dim]
        x = self.input_projection(x)  # [batch_size, seq_len, d_model]
        x = self.pos_encoder(x)
        out = self.transformer_encoder(x)  # [batch_size, seq_len, d_model]
        
        # Mean pooling over the sequence dimension
        out = out.mean(dim=1)  # [batch_size, d_model]
        return self.fc(out).squeeze(-1)  # [batch_size]
