/**
 * HandView.tsx
 *
 * Standalone demo page / panel for testing MediaPipe Hands tracking.
 * Shows the webcam feed with live landmark overlay, per-hand data,
 * and a collapsible raw-coordinates panel.
 *
 * Usage: drop <HandView /> anywhere. No drawing integration.
 */

import React, { useState, useCallback } from 'react';
import HandOverlay from './HandOverlay';
import type { DetectedHand } from '../hooks/useHandTracking';

const FINGER_NAMES = [
  'Wrist',
  'Thumb CMC', 'Thumb MCP', 'Thumb IP', 'Thumb Tip',
  'Index MCP', 'Index PIP', 'Index DIP', 'Index Tip',
  'Middle MCP', 'Middle PIP', 'Middle DIP', 'Middle Tip',
  'Ring MCP', 'Ring PIP', 'Ring DIP', 'Ring Tip',
  'Pinky MCP', 'Pinky PIP', 'Pinky DIP', 'Pinky Tip',
];

export default function HandView() {
  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showSkeleton, setShowSkeleton]   = useState(true);
  const [complexity, setComplexity]       = useState<0 | 1>(1);
  const [activeTab, setActiveTab]         = useState<'overlay' | 'data'>('overlay');

  const handleHandsChange = useCallback((h: DetectedHand[]) => {
    setHands(h);
  }, []);

  return (
    <div className="hv-root">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="hv-header">
        <div className="hv-title">
          <span className="hv-logo">✋</span>
          <div>
            <h1 className="hv-h1">Hand Tracking</h1>
            <p className="hv-sub">MediaPipe Hands · Up to 2 hands · 21 landmarks</p>
          </div>
        </div>

        {/* Toggles */}
        <div className="hv-toggles">
          <label className="hv-toggle">
            <input
              id="hv-toggle-landmarks"
              type="checkbox"
              checked={showLandmarks}
              onChange={(e) => setShowLandmarks(e.target.checked)}
            />
            <span className="hv-toggle-track" />
            Landmarks
          </label>
          <label className="hv-toggle">
            <input
              id="hv-toggle-skeleton"
              type="checkbox"
              checked={showSkeleton}
              onChange={(e) => setShowSkeleton(e.target.checked)}
            />
            <span className="hv-toggle-track" />
            Skeleton
          </label>
          <label className="hv-toggle">
            <input
              id="hv-toggle-complexity"
              type="checkbox"
              checked={complexity === 1}
              onChange={(e) => setComplexity(e.target.checked ? 1 : 0)}
            />
            <span className="hv-toggle-track" />
            Full model
          </label>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className="hv-tabs">
        <button
          id="hv-tab-overlay"
          className={`hv-tab ${activeTab === 'overlay' ? 'hv-tab-active' : ''}`}
          onClick={() => setActiveTab('overlay')}
        >
          Camera &amp; Overlay
        </button>
        <button
          id="hv-tab-data"
          className={`hv-tab ${activeTab === 'data' ? 'hv-tab-active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          Landmark Data
          {hands.length > 0 && (
            <span className="hv-badge">{hands.reduce((s, h) => s + h.landmarks.length, 0)}</span>
          )}
        </button>
      </div>

      {/* ── Tab: Camera ────────────────────────────────────────────────── */}
      {activeTab === 'overlay' && (
        <div className="hv-tab-content">
          <HandOverlay
            width={640}
            height={480}
            showLandmarks={showLandmarks}
            showSkeleton={showSkeleton}
            onHandsChange={handleHandsChange}
            options={{ maxNumHands: 2, modelComplexity: complexity }}
          />

          {/* Quick stats */}
          {hands.length > 0 && (
            <div className="hv-stats">
              {hands.map((hand) => (
                <div key={hand.index} className={`hv-stat-card hv-stat-${hand.handedness.toLowerCase()}`}>
                  <div className="hv-stat-label">{hand.handedness} Hand</div>
                  <div className="hv-stat-conf">{(hand.confidence * 100).toFixed(1)}%</div>
                  <div className="hv-stat-hint">confidence</div>
                  <div className="hv-stat-wrist">
                    Wrist: ({hand.landmarks[0].x.toFixed(2)}, {hand.landmarks[0].y.toFixed(2)})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Landmark Data ─────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="hv-tab-content hv-data-tab">
          {hands.length === 0 ? (
            <div className="hv-empty">
              <span style={{ fontSize: 48 }}>✋</span>
              <p>No hands detected. Start the camera and show your hand.</p>
            </div>
          ) : (
            hands.map((hand) => (
              <div key={hand.index} className="hv-data-hand">
                <div className={`hv-data-hand-header hv-data-${hand.handedness.toLowerCase()}`}>
                  {hand.handedness} Hand
                  <span className="hv-data-conf">
                    {(hand.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
                <table className="hv-lm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>X</th>
                      <th>Y</th>
                      <th>Z (depth)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hand.landmarks.map((lm, i) => (
                      <tr key={i} className={[4, 8, 12, 16, 20].includes(i) ? 'hv-lm-tip' : ''}>
                        <td className="hv-lm-idx">{i}</td>
                        <td className="hv-lm-name">{FINGER_NAMES[i]}</td>
                        <td className="hv-lm-val">{lm.x.toFixed(4)}</td>
                        <td className="hv-lm-val">{lm.y.toFixed(4)}</td>
                        <td className="hv-lm-z">{lm.z.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
