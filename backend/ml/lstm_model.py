import torch
import torch.nn as nn
import torch.nn.functional as F

class BiLSTMWithAttention(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 64, num_layers: int = 2, num_heads: int = 4):
        """
        Bidirectional LSTM Neural Network with Multi-Head Self-Attention.
        
        Args:
            input_dim (int): Number of input features per timestep.
            hidden_dim (int): Hidden dimensions of LSTM nodes.
            num_layers (int): Depth of LSTM layers.
            num_heads (int): Number of attention heads.
        """
        super(BiLSTMWithAttention, self).__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        # Bidirectional LSTM Layer
        # output size per timestep: hidden_dim * 2
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=0.15 if num_layers > 1 else 0.0
        )
        
        # Multi-Head Attention layer over the sequence dimension
        # Embedding dimension is hidden_dim * 2 (due to bidirectionality)
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_dim * 2,
            num_heads=num_heads,
            batch_first=True
        )
        
        # Batch normalization for training stability
        self.bn = nn.BatchNorm1d(hidden_dim * 2)
        
        # Fully connected layers mapping output state to predicted return
        self.fc1 = nn.Linear(hidden_dim * 2, 32)
        self.dropout = nn.Dropout(0.20)
        self.fc2 = nn.Linear(32, 1)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [batch_size, sequence_length, input_dim]
        
        # Pass through BiLSTM
        # out shape: [batch_size, sequence_length, hidden_dim * 2]
        out, _ = self.lstm(x)
        
        # Self-Attention pooling over sequence length
        # attn_out shape: [batch_size, sequence_length, hidden_dim * 2]
        attn_out, _ = self.attention(out, out, out)
        
        # Average pooling along the sequence length (timestep dimension)
        # pool_out shape: [batch_size, hidden_dim * 2]
        pool_out = torch.mean(attn_out, dim=1)
        
        # Batch Normalization
        norm_out = self.bn(pool_out)
        
        # Fully connected head
        out = F.leaky_relu(self.fc1(norm_out))
        out = self.dropout(out)
        out = self.fc2(out)
        
        return out.squeeze(-1) # Output shape: [batch_size]
