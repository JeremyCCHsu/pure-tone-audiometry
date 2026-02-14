import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import { TestResult } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ResultsProps {
  results: TestResult[];
  baselineGain?: number;
  onRestart: () => void;
  onContinue?: () => void;
  onHome: () => void;
}

const DownloadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export const Results: React.FC<ResultsProps> = ({ results, baselineGain, onRestart, onContinue, onHome }) => {
  const { t } = useTranslation();
  const audiogramRef = useRef<any>(null);
  const reactionTimeRef = useRef<any>(null);

  const downloadImage = (chartRef: React.RefObject<any>, fileName: string) => {
    if (chartRef.current) {
        const link = document.createElement('a');
        link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = chartRef.current.toBase64Image();
        link.click();
    }
  };
  // Process results
  // We want to link frequency (x) to dB (y)
  // Usually Audiograms have 0 top, 100 bottom. We can invert axis in chartjs.

  const leftResults = results.filter(r => r.ear === 'left' && r.responseDetected).sort((a,b) => a.frequency - b.frequency);
  const rightResults = results.filter(r => r.ear === 'right' && r.responseDetected).sort((a,b) => a.frequency - b.frequency);

  // We should only take the *lowest* dB heard for each frequency (sensitivity)
  // Use a map to get min dB per freq
  const getThresholds = (list: TestResult[]) => {
      const map = new Map<number, number>();
      list.forEach(r => {
          const curent = map.get(r.frequency);
          if (curent === undefined || r.db < curent) { // "db" here is relative, e.g. -2.5. Low is "good"?
             // My logic: 0 is baseline. -2.5 is quieter. +5 is louder.
             // So MINIMUM stored value is the best hearing (quietest).
             map.set(r.frequency, r.db);
          }
      });
      return Array.from(map.entries()).sort((a,b) => a[0] - b[0]);
  };

  const leftThresholds = getThresholds(leftResults);
  const rightThresholds = getThresholds(rightResults);

  /*
     We need to plot:
     1. Left Thresholds (Line)
     2. Right Thresholds (Line)
     3. Left Hits (Scatter Circle)
     4. Right Hits (Scatter Circle)
     5. Left Misses (Scatter Cross)
     6. Right Misses (Scatter Cross)
  */

  const allFrequencies = Array.from(new Set(results.map(r => r.frequency))).sort((a,b)=>a-b);

  // Helpers
  const getPoints = (filterFn: (r: TestResult) => boolean) => {
      return results.filter(filterFn).map(r => ({ x: r.frequency, y: r.db }));
  };

  const leftThresholdMap = new Map(leftThresholds);
  const rightThresholdMap = new Map(rightThresholds);

  const leftHits = getPoints(r => r.ear === 'left' && r.responseDetected && r.db !== leftThresholdMap.get(r.frequency));
  const rightHits = getPoints(r => r.ear === 'right' && r.responseDetected && r.db !== rightThresholdMap.get(r.frequency));
  const leftMisses = getPoints(r => r.ear === 'left' && !r.responseDetected);
  const rightMisses = getPoints(r => r.ear === 'right' && !r.responseDetected);

  const leftThresholdDataPoints = allFrequencies.map(f => ({
    x: f,
    y: leftThresholdMap.has(f) ? leftThresholdMap.get(f) : null
  }));
  const rightThresholdDataPoints = allFrequencies.map(f => ({
    x: f,
    y: rightThresholdMap.has(f) ? rightThresholdMap.get(f) : null
  }));

  // Procedural Drawing Functions for Sharp Markers
  const drawMarker = (chartCtx: CanvasRenderingContext2D, x: number, y: number, char: string, isBold: boolean, color: string, fontSize: number = 14) => {
    chartCtx.save();
    chartCtx.fillStyle = color;
    chartCtx.font = `${isBold ? 'bold' : ''} ${fontSize}px serif`;
    chartCtx.textAlign = 'center';
    chartCtx.textBaseline = 'middle';
    chartCtx.fillText(char, x, y);
    chartCtx.restore();
    return undefined;
  };

  const data = {
    labels: allFrequencies,
    datasets: [
      {
        label: t('results.leftThreshold'),
        data: leftThresholdDataPoints as any,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        pointStyle: (ctx: any) => drawMarker(ctx.chart.ctx, ctx.x, ctx.y, '◖', true, 'rgb(53, 162, 235)', 14) as any,
        pointRadius: 8,
        pointBorderWidth: 2,
        order: 1,
        spanGaps: false
      },
      {
        label: t('results.rightThreshold'),
        data: rightThresholdDataPoints as any,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointStyle: (ctx: any) => drawMarker(ctx.chart.ctx, ctx.x, ctx.y, '◗', true, 'rgb(255, 99, 132)', 14) as any,
        pointRadius: 8,
        order: 2,
        spanGaps: false
      },
      // Scatter points for all events
      {
          label: t('results.leftHits'),
          data: leftHits,
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          pointStyle: (ctx: any) => drawMarker(ctx.chart.ctx, ctx.x, ctx.y, '(', false, 'rgb(53, 162, 235)', 12) as any,
          pointRadius: 5,
          showLine: false,
          order: 3
      },
      {
          label: t('results.rightHits'),
          data: rightHits,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointStyle: (ctx: any) => drawMarker(ctx.chart.ctx, ctx.x, ctx.y, ')', false, 'rgb(255, 99, 132)', 12) as any,
          pointRadius: 5,
          showLine: false,
          order: 4
      },
      {
          label: t('results.leftMisses'),
          data: leftMisses,
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          pointStyle: 'crossRot', // 'crossRot' is X, 'cross' is +
          pointRadius: 4,
          pointBorderWidth: 1,
          showLine: false,
          order: 5
      },
      {
          label: t('results.rightMisses'),
          data: rightMisses,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointStyle: 'crossRot',
          pointRadius: 4,
          pointBorderWidth: 1,
          showLine: false,
          order: 6
      }
    ],
  };

  const options = {
    responsive: true,
    devicePixelRatio: 3, // Increase resolution
    scales: {
      y: {
        reverse: true, // We want low numbers (negative dB = quiet) at the TOP (good hearing)
        // Values: 0 (Baseline), +High (Bad), -Low (Good)
        // So graph -10 at top, +40 at bottom.
        // Reverse: true handles this if Min < Max.
        // Let's set min/max based on data or fixed range
        title: {
            display: true,
            text: t('results.dbRelative')
        },
        // Suggested range
        suggestedMin: -10,
        suggestedMax: 50,
        grid: {
            color: (context: any) => {
                if (context.tick.value === 0) return 'rgba(0, 0, 0, 0.5)';
                return 'rgba(0, 0, 0, 0.1)';
            },
            lineWidth: (context: any) => {
                if (context.tick.value === 0) return 2;
                return 1;
            }
        }
      },
      x: {
          offset: true,
          title: {
            display: true,
            text: t('results.frequencyHz')
          }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            usePointStyle: true,
        }
      },
      title: {
        display: true,
        text: t('results.audiogramTitle'),
      },
    },
  };

  const exportJSON = () => {
      const exportData = {
          timestamp: new Date().toISOString(),
          baselineGain: baselineGain || 0,
          results
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `hearing_test_${new Date().toISOString()}.json`;
      link.click();
  };

  return (
    <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', paddingBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>{t('results.title')}</h2>
      <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', position: 'relative' }}>
        <button
          onClick={() => downloadImage(audiogramRef, 'audiogram')}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(51, 51, 51, 0.6)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backdropFilter: 'blur(2px)',
            transition: 'background-color 0.2s'
          }}
          title="Download Image"
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(100, 108, 255, 0.8)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 51, 51, 0.6)'}
        >
          <DownloadIcon />
        </button>
        <div style={{ height: '300px', position: 'relative', width: '100%' }}>
            <Line ref={audiogramRef} options={{...options, maintainAspectRatio: false}} data={data} />
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', marginTop: '1.5rem', position: 'relative' }}>
        <button
          onClick={() => downloadImage(reactionTimeRef, 'reaction_time')}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(51, 51, 51, 0.6)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backdropFilter: 'blur(2px)',
            transition: 'background-color 0.2s'
          }}
          title="Download Image"
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(100, 108, 255, 0.8)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 51, 51, 0.6)'}
        >
          <DownloadIcon />
        </button>
        <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0', color: '#333' }}>{t('results.responseTimeAnalysis')}</h3>
        <div style={{ height: '300px', position: 'relative', width: '100%' }}>
            <Scatter
                ref={reactionTimeRef}
                options={{
                    ...options, // reuse base options for responsiveness
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            offset: true,
                            title: { display: true, text: t('results.frequencyHz') }
                        },
                        y: {
                            title: { display: true, text: t('results.reactionTimeMs') },
                            beginAtZero: true,
                            suggestedMin: 0,
                            suggestedMax: 2000
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: t('results.reactionTimeVsFreq')
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const pt = context.raw as any;
                                    return t('results.tooltipLabel', { x: pt.x, y: pt.y, db: pt.db });
                                }
                            }
                        }
                    }
                }}
                data={{
                    datasets: [{
                        label: t('results.responseTime'),
                        data: results
                            .filter(r => r.responseDetected && r.reactionTime)
                            .map(r => ({
                                x: r.frequency,
                                y: r.reactionTime,
                                db: r.db // Attach for tooltip
                            })),
                        backgroundColor: results
                            .filter(r => r.responseDetected && r.reactionTime)
                            .map(r => {
                                const minDb = -10;
                                const maxDb = 60;
                                let norm = (r.db - minDb) / (maxDb - minDb);
                                norm = Math.max(0.1, Math.min(1, norm));
                                const lightness = 90 - (norm * 60);
                                return `hsl(0, 100%, ${lightness}%)`;
                            }),
                        pointRadius: 8
                    }]
                }}
            />
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={exportJSON} style={{ flex: '1 1 auto', minWidth: '120px' }}>{t('results.exportJson')}</button>
        {onContinue && <button onClick={onContinue} style={{ flex: '1 1 auto', minWidth: '120px' }}>{t('results.continueHigh')}</button>}
        <button onClick={onRestart} style={{ flex: '1 1 auto', minWidth: '120px' }}>{t('results.restart')}</button>
        <button onClick={onHome} style={{backgroundColor: '#555', flex: '1 1 auto', minWidth: '120px'}}>{t('results.returnToHome')}</button>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'left', fontSize: '0.9em', color: '#888' }}>
        <p><strong>{t('results.baselineGain')}:</strong> {baselineGain ? baselineGain.toExponential(4) : 'N/A'}</p>
        <p>{t('results.note')}</p>
      </div>
    </div>
  );
};
