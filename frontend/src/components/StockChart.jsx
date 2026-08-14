import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, 
  Title, Tooltip, Legend, Filler, ArcElement, annotationPlugin
)

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL']

export default function StockChart({ history, prediction, timeframe, onTimeframeChange, livePrice }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  
  if (!history || history.length === 0) return (
    <div className="panel">
      <div className="spinner">Loading chart data...</div>
    </div>
  )

  // Filter data based on timeframe
  const filteredData = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()
    
    switch(timeframe) {
      case '1D': cutoff.setHours(now.getHours() - 24); break
      case '1W': cutoff.setDate(now.getDate() - 7); break
      case '1M': cutoff.setMonth(now.getMonth() - 1); break
      case '3M': cutoff.setMonth(now.getMonth() - 3); break
      case '6M': cutoff.setMonth(now.getMonth() - 6); break
      case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break
      default: return history // ALL
    }
    
    return history.filter(d => new Date(d.date) >= cutoff)
  }, [history, timeframe])

  const labels = filteredData.map(d => {
    const date = new Date(d.date)
    return timeframe === '1D' 
      ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  })
  
  const closes = filteredData.map(d => d.close)
  const volumes = filteredData.map(d => d.volume || 0)
  const sma20  = filteredData.map(d => d.sma_20 || null)
  const sma50  = filteredData.map(d => d.sma_50 || null)
  
  // Calculate min/max for better scaling
  const allPrices = [...closes, ...sma20.filter(Boolean), ...sma50.filter(Boolean)]
  const minPrice = Math.min(...allPrices) * 0.98
  const maxPrice = Math.max(...allPrices) * 1.02

  // Extend for prediction overlay with confidence intervals
  let predLabels = [...labels]
  let predData   = Array(labels.length).fill(null)
  let predLower  = Array(labels.length).fill(null)
  let predUpper  = Array(labels.length).fill(null)

  if (prediction?.predicted_price_7d) {
    const lastDate = new Date(filteredData[filteredData.length - 1].date)
    const currentPrice = closes[closes.length - 1]
    const volatility = prediction.volatility || 0.02
    
    // Generate 7-day prediction points
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(lastDate)
      futureDate.setDate(futureDate.getDate() + i)
      const futureLabel = timeframe === '1D' 
        ? futureDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : futureDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      
      predLabels.push(futureLabel)
      
      // Linear interpolation for smooth curve
      const progress = i / 7
      const predictedValue = currentPrice + (prediction.predicted_price_7d - currentPrice) * progress
      const margin = predictedValue * volatility * Math.sqrt(i)
      
      predData.push(predictedValue)
      predLower.push(predictedValue - margin)
      predUpper.push(predictedValue + margin)
    }
  }

  const allLabels = predLabels
  
  const data = {
    labels: allLabels,
    datasets: [
      {
        label: 'Close Price',
        data: [...closes, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#6366F1',
        backgroundColor: (context) => {
          const chart = context.chart
          const {ctx, chartArea} = chart
          if (!chartArea) return null
          
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.0)')
          gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)')
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)')
          return gradient
        },
        borderWidth: 2.5,
        pointRadius: (ctx) => hoveredPoint === ctx.dataIndex ? 6 : 0,
        pointHoverRadius: 8,
        pointBackgroundColor: '#6366F1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Volume',
        data: [...volumes, ...(prediction?.predicted_price_7d ? Array(7).fill(0) : [])],
        type: 'bar',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        yAxisID: 'y1',
        hidden: true,
      },
      {
        label: 'SMA 20',
        data: [...sma20, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#06B6D4',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      },
      {
        label: 'SMA 50',
        data: [...sma50, ...(prediction?.predicted_price_7d ? [null] : [])],
        borderColor: '#F59E0B',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      },
      ...(prediction?.predicted_price_7d ? [
        {
          label: '7D Prediction',
          data: predData,
          borderColor: '#F43F5E',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: (ctx) => ctx.dataIndex === allLabels.length - 1 ? 8 : 4,
          pointBackgroundColor: '#F43F5E',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Upper Bound (95% CI)',
          data: predUpper,
          borderColor: 'rgba(244, 63, 94, 0.3)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.4,
          fill: '+1',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
        },
        {
          label: 'Lower Bound (95% CI)',
          data: predLower,
          borderColor: 'rgba(244, 63, 94, 0.3)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
      ] : []),
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    onHover: (e, elements) => {
      setHoveredPoint(elements.length > 0 ? elements[0].index : null)
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { 
          color: '#9CA3AF', 
          boxWidth: 14, 
          padding: 15,
          font: { size: 11, family: 'JetBrains Mono' },
          usePointStyle: true,
          filter: (legendItem) => legendItem.text !== 'Volume'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(12, 16, 34, 0.95)',
        borderColor: 'rgba(99,102,241,0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        titleColor: '#F0F0FF',
        titleFont: { size: 13, family: 'JetBrains Mono', weight: 'bold' },
        bodyColor: '#9CA3AF',
        bodyFont: { size: 11, family: 'JetBrains Mono' },
        bodySpacing: 6,
        padding: 12,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          title: (items) => allLabels[items[0].dataIndex] || '',
          label: (ctx) => {
            const value = ctx.raw
            if (value === null || value === undefined) return null
            if (ctx.dataset.label.includes('Bound')) {
              return `${ctx.dataset.label}: ₹${Number(value).toFixed(2)}`
            }
            if (ctx.dataset.label === 'Volume') {
              return `${ctx.dataset.label}: ${(value / 1000).toFixed(1)}K`
            }
            return `${ctx.dataset.label}: ₹${Number(value).toFixed(2)}`
          },
          afterBody: (ctx) => {
            if (livePrice && ctx[0].dataIndex === closes.length - 1) {
              return `\nLive: ₹${livePrice.toFixed(2)}`
            }
            return ''
          }
        }
      },
      annotation: {
        annotations: {
          livePriceLine: livePrice ? {
            type: 'line',
            yMin: livePrice,
            yMax: livePrice,
            borderColor: '#10B981',
            borderWidth: 2,
            borderDash: [4, 4],
            label: {
              content: `Live: ₹${livePrice.toFixed(2)}`,
              enabled: true,
              position: 'end',
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              color: '#fff',
              font: { size: 11, family: 'JetBrains Mono', weight: 'bold' },
              padding: 6,
              borderRadius: 4
            }
          } : undefined,
          predictionMarker: prediction?.predicted_price_7d ? {
            type: 'point',
            xValue: allLabels.length - 1,
            yValue: prediction.predicted_price_7d,
            radius: 10,
            backgroundColor: 'rgba(244, 63, 94, 0.3)',
            borderColor: '#F43F5E',
            borderWidth: 3,
          } : undefined
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#6B7280', 
          maxTicksLimit: timeframe === '1D' ? 12 : 8,
          font: { size: 10, family: 'JetBrains Mono' },
          maxRotation: 0,
          autoSkip: true
        },
        grid: { color: 'rgba(99,102,241,0.08)', drawBorder: false },
      },
      y: {
        min: minPrice,
        max: maxPrice,
        ticks: {
          color: '#6B7280',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: v => `₹${v.toFixed(0)}`,
          maxTicksLimit: 8
        },
        grid: { color: 'rgba(99,102,241,0.08)', drawBorder: false },
      },
      y1: {
        type: 'linear',
        display: false,
        position: 'right',
        grid: { drawOnChartArea: false },
      }
    }
  }

  return (
    <div className="panel" style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <h3 style={{ margin: 0, color: '#F0F0FF', fontSize: '1.1rem' }}>
          📈 Price Chart
          {livePrice && (
            <span style={{ 
              marginLeft: 10, 
              fontSize: '0.85rem', 
              color: '#10B981',
              fontFamily: 'JetBrains Mono'
            }}>
              ● Live: ₹{livePrice.toFixed(2)}
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              className={`btn ${timeframe === t ? 'btn-primary' : 'btn-ghost'}`}
              style={{ 
                padding: '6px 14px', 
                fontSize: '0.75rem',
                fontWeight: timeframe === t ? 600 : 400
              }}
              onClick={() => onTimeframeChange(t)}
            >{t}</button>
          ))}
        </div>
      </div>
      
      <div className="chart-wrap" style={{ height: 380, position: 'relative' }}>
        <Line data={data} options={options} />
      </div>
      
      {/* Legend Guide */}
      <div style={{ 
        marginTop: 16, 
        paddingTop: 12, 
        borderTop: '1px solid rgba(99,102,241,0.1)',
        display: 'flex', 
        gap: 16, 
        fontSize: '0.75rem',
        color: '#6B7280',
        flexWrap: 'wrap',
        fontFamily: 'JetBrains Mono'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, background: '#6366F1' }}></span>
          Close Price
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, background: '#06B6D4', borderLeft: '2px dashed #06B6D4' }}></span>
          SMA 20
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, background: '#F59E0B', borderLeft: '2px dashed #F59E0B' }}></span>
          SMA 50
        </span>
        {prediction?.predicted_price_7d && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 2, background: '#F43F5E', borderLeft: '3px dashed #F43F5E' }}></span>
              AI Prediction
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 8, background: 'rgba(244, 63, 94, 0.15)', border: '1px dashed rgba(244, 63, 94, 0.4)' }}></span>
              Confidence Interval
            </span>
          </>
        )}
      </div>
    </div>
  )
}
