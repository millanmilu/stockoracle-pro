import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y']

export default function StockChart({ history, prediction, timeframe, onTimeframeChange }) {
  if (!history || history.length === 0) return <div className="spinner" />

  const labels = history.map(d => d.date)
  const closes = history.map(d => d.close)
  const sma20  = history.map(d => d.sma_20 || null)
  const sma50  = history.map(d => d.sma_50 || null)

  // Extend 7 days for prediction overlay
  let predLabels = [...labels]
  let predData   = Array(labels.length).fill(null)

  if (prediction?.predicted_price_7d) {
    const lastDate = new Date(labels[labels.length - 1])
    lastDate.setDate(lastDate.getDate() + 7)
    const futureLabel = lastDate.toISOString().split('T')[0]
    predLabels = [...labels, futureLabel]
    predData   = [...Array(labels.length - 1).fill(null), closes[closes.length - 1], prediction.predicted_price_7d]
  }

  const allLabels = predLabels

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: 'Close',
        data: [...closes, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#6366F1',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
      {
        label: 'SMA 20',
        data: [...sma20, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#06B6D4',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
      {
        label: 'SMA 50',
        data: [...sma50, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
      ...(prediction?.predicted_price_7d ? [{
        label: '7D Prediction',
        data: predData,
        borderColor: '#F43F5E',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: [0,0,0,0,0,6],
        pointBackgroundColor: '#F43F5E',
        tension: 0,
        fill: false,
      }] : []),
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0C1022',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#F0F0FF',
        bodyColor: '#9CA3AF',
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#4B5563', maxTicksLimit: 8,
          font: { size: 10, family: 'JetBrains Mono' }
        },
        grid: { color: 'rgba(99,102,241,0.06)' },
      },
      y: {
        ticks: {
          color: '#4B5563',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: v => `$${v.toFixed(0)}`
        },
        grid: { color: 'rgba(99,102,241,0.06)' },
      }
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {TIMEFRAMES.map(t => (
          <button
            key={t}
            className={`btn ${timeframe === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            onClick={() => onTimeframeChange(t)}
          >{t}</button>
        ))}
      </div>
      <div className="chart-wrap" style={{ height: 300 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
