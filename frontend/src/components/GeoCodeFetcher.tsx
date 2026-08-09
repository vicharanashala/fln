import React, { useState } from 'react';
import { fetchGeoDetails } from '../utils/geoLookup';

interface GeoCodeFetcherProps {
  onAutoSelect?: (details: { stateCode: string | null; districtCode: string | null }) => void;
  compact?: boolean;
}

export const GeoCodeFetcher: React.FC<GeoCodeFetcherProps> = ({ onAutoSelect, compact = false }) => {
  const [stateInput, setStateInput] = useState('');
  const [districtInput, setDistrictInput] = useState('');

  const geoDetails = fetchGeoDetails(stateInput, districtInput);

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStateInput(val);
    const details = fetchGeoDetails(val, districtInput);
    if (onAutoSelect) {
      onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode });
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDistrictInput(val);
    const details = fetchGeoDetails(stateInput, val);
    if (onAutoSelect) {
      onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode });
    }
  };

  const presetExamples = [
    { state: 'Punjab', district: 'Ludhiana', expectedS: 'PB', expectedD: 'LDH' },
    { state: 'West Bengal', district: 'Howrah', expectedS: 'WB', expectedD: 'HWH' },
    { state: 'Haryana', district: 'Ambala', expectedS: 'HR', expectedD: 'AMB' },
    { state: 'Delhi', district: 'North Delhi', expectedS: 'DL', expectedD: 'NDL' },
  ];

  return (
    <div className={`rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Automatic Geo-Code Fetcher</h3>
            <p className="text-xs text-slate-500">Type state or district names to instantly resolve state & district codes</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          Auto Lookup Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* State Input */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              State Name / Input
            </label>
            {geoDetails.stateCode ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                Code: {geoDetails.stateCode}
              </span>
            ) : stateInput ? (
              <span className="text-xs text-amber-600 font-medium">Unrecognized state</span>
            ) : null}
          </div>
          <input
            type="text"
            value={stateInput}
            onChange={handleStateChange}
            placeholder="e.g. Punjab, West Bengal, Rajasthan..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {/* District Input */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              District Name / Input
            </label>
            {geoDetails.districtCode ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                Code: {geoDetails.districtCode}
              </span>
            ) : districtInput ? (
              <span className="text-xs text-amber-600 font-medium">Unrecognized district</span>
            ) : null}
          </div>
          <input
            type="text"
            value={districtInput}
            onChange={handleDistrictChange}
            placeholder="e.g. Ludhiana, Howrah, Jaipur..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* Real-time Code Fetch Status Banner */}
      {(geoDetails.stateCode || geoDetails.districtCode) && (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3 shadow-inner">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fetched Geo Codes</p>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">State:</span>{' '}
              <span className="font-semibold text-slate-800">{geoDetails.stateName || stateInput}</span> ➔{' '}
              <span className="font-bold text-indigo-600">{geoDetails.stateCode || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500">District:</span>{' '}
              <span className="font-semibold text-slate-800">{geoDetails.districtName || districtInput}</span> ➔{' '}
              <span className="font-bold text-emerald-600">{geoDetails.districtCode || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Preset Example Quick Buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Quick Test:</span>
        {presetExamples.map((ex) => (
          <button
            key={ex.state + ex.district}
            type="button"
            onClick={() => {
              setStateInput(ex.state);
              setDistrictInput(ex.district);
              const details = fetchGeoDetails(ex.state, ex.district);
              if (onAutoSelect) {
                onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode });
              }
            }}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            {ex.state} ({ex.expectedS}) / {ex.district} ({ex.expectedD})
          </button>
        ))}
      </div>
    </div>
  );
};
