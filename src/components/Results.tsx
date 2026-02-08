import React from 'react';
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

export const Results: React.FC<ResultsProps> = ({ results, baselineGain, onRestart, onContinue, onHome }) => {
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

  const leftHits = getPoints(r => r.ear === 'left' && r.responseDetected);
  const rightHits = getPoints(r => r.ear === 'right' && r.responseDetected);
  const leftMisses = getPoints(r => r.ear === 'left' && !r.responseDetected);
  const rightMisses = getPoints(r => r.ear === 'right' && !r.responseDetected);

  const leftThresholdPoints = leftThresholds.map(t => ({ x: t[0], y: t[1] }));
  const rightThresholdPoints = rightThresholds.map(t => ({ x: t[0], y: t[1] }));

  const data = {
    labels: allFrequencies,
    datasets: [
      {
        label: 'Left Threshold',
        data: leftThresholdPoints,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        pointStyle: 'circle',
        pointRadius: 8,
        pointBorderWidth: 2,
        order: 1
      },
      {
        label: 'Right Threshold',
        data: rightThresholdPoints,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointStyle: 'circle',
        pointRadius: 8,
        order: 2
      },
      // Scatter points for all events
      {
          label: 'Left Hits',
          data: leftHits,
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
          order: 3
      },
      {
          label: 'Right Hits',
          data: rightHits,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
          order: 4
      },
      {
          label: 'Left Misses',
          data: leftMisses,
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          pointStyle: 'cross',
          pointRadius: 6,
          pointBorderWidth: 2,
          rotation: 45, // Make it look like 'x' if cross is '+'. 'cross' is usually '+'. 'crossRot' is 'x'.
          // cross is +, crossRot is x. User asked for 'crosses'. Usually means X.
          // Let's use 'crossRot' for X shape? Or just 'cross'.
          // 'cross' in ChartJS is a plus (+). 'crossRot' is (x).
          // User said "failed trials are shown as crosses". X is common.
          showLine: false,
          order: 5
      },
      {
          label: 'Right Misses',
          data: rightMisses,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointStyle: 'cross',
          pointRadius: 6,
          pointBorderWidth: 2,
          rotation: 45,
          showLine: false,
          order: 6
      }
    ],
  };

  const options = {
    responsive: true,
    scales: {
      y: {
        reverse: true, // We want low numbers (negative dB = quiet) at the TOP (good hearing)
        // Values: 0 (Baseline), +High (Bad), -Low (Good)
        // So graph -10 at top, +40 at bottom.
        // Reverse: true handles this if Min < Max.
        // Let's set min/max based on data or fixed range
        title: {
            display: true,
            text: 'dB relative to Baseline'
        },
        // Suggested range
        suggestedMin: -10,
        suggestedMax: 50,
      },
      x: {
          title: {
            display: true,
            text: 'Frequency (Hz)'
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
        text: 'Audiogram (Relative to Baseline)',
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
      <h2 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>Results</h2>
      <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px' }}>
        <div style={{ height: '300px', position: 'relative', width: '100%' }}>
            <Line options={{...options, maintainAspectRatio: false}} data={data} />
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0', color: '#333' }}>Response Time Analysis</h3>
        <div style={{ height: '300px', position: 'relative', width: '100%' }}>
            <Scatter
                options={{
                    ...options, // reuse base options for responsiveness
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Frequency (Hz)' }
                        },
                        y: {
                            title: { display: true, text: 'Reaction Time (ms)' },
                            beginAtZero: true,
                            suggestedMin: 0,
                            suggestedMax: 2000
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Reaction Time vs Frequency'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const pt = context.raw as any;
                                    return `Freq: ${pt.x}Hz, Time: ${pt.y}ms, Vol: ${pt.db}dB`;
                                }
                            }
                        }
                    }
                }}
                data={{
                    datasets: [{
                        label: 'Response Time',
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
        <button onClick={exportJSON} style={{ flex: '1 1 auto', minWidth: '120px' }}>Export JSON</button>
        {onContinue && <button onClick={onContinue} style={{ flex: '1 1 auto', minWidth: '120px' }}>Continue (High Freq)</button>}
        <button onClick={onRestart} style={{ flex: '1 1 auto', minWidth: '120px' }}>Restart Test</button>
        <button onClick={onHome} style={{backgroundColor: '#555', flex: '1 1 auto', minWidth: '120px'}}>Return to Home</button>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'left', fontSize: '0.9em', color: '#888' }}>
        <p><strong>Baseline Gain:</strong> {baselineGain ? baselineGain.toExponential(4) : 'N/A'}</p>
        <p>Note: These results are relative to your baseline.
           0 dB = Baseline volume. Negative values = Quieter than baseline. Positive = Louder.
           Values higher on the chart (more negative) indicate better hearing sensitivity.
           This is NOT a medical diagnosis.</p>
      </div>
    </div>
  );
};
