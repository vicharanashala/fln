import React, { useState } from 'react';
import { fetchGeoDetails } from '../utils/geoLookup';

interface GeoCodeFetcherProps {
  onAutoSelect?: (details: { stateCode: string | null; districtCode: string | null; blockCode: string | null; blockName: string | null }) => void;
  compact?: boolean;
}

export const GeoCodeFetcher: React.FC<GeoCodeFetcherProps> = ({ onAutoSelect, compact = false }) => {
  const [stateInput, setStateInput] = useState('');
  const [districtInput, setDistrictInput] = useState('');
  const [blockInput, setBlockInput] = useState('');

  const geoDetails = fetchGeoDetails(stateInput, districtInput, blockInput);

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStateInput(val);
    const details = fetchGeoDetails(val, districtInput, blockInput);
    if (onAutoSelect) {
      onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode, blockCode: details.blockCode, blockName: details.blockName });
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDistrictInput(val);
    const details = fetchGeoDetails(stateInput, val, blockInput);
    if (onAutoSelect) {
      onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode, blockCode: details.blockCode, blockName: details.blockName });
    }
  };

  const handleBlockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBlockInput(val);
    const details = fetchGeoDetails(stateInput, districtInput, val);
    if (onAutoSelect) {
      onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode, blockCode: details.blockCode, blockName: details.blockName });
    }
  };

  const presetExamples = [
    { state: 'Punjab', district: 'Ludhiana', block: 'LDH-01', expectedS: 'PB', expectedD: 'LDH', expectedBName: 'Ludhiana Block 1' },
    { state: 'Punjab', district: 'Amritsar', block: 'ASR-02', expectedS: 'PB', expectedD: 'ASR', expectedBName: 'Amritsar Block 2' },
    { state: 'Rajasthan', district: 'Jaipur', block: 'JAI-01', expectedS: 'RJ', expectedD: 'JAI', expectedBName: 'Jaipur Block 1' },
    { state: 'Haryana', district: 'Ambala', block: 'AMB-01', expectedS: 'HR', expectedD: 'AMB', expectedBName: 'Ambala Block 1' },
  ];

  return (
    <div className={`rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Automatic Geo & Block Code Fetcher</h3>
            <p className="text-xs text-slate-500">Type block code (e.g. LDH-01), district or state names to auto-fetch names & codes</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          Auto Lookup Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* State Input */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              State Input
            </label>
            {geoDetails.stateCode ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                Code: {geoDetails.stateCode}
              </span>
            ) : stateInput ? (
              <span className="text-xs text-amber-600 font-medium">Unrecognized</span>
            ) : null}
          </div>
          <input
            type="text"
            value={stateInput}
            onChange={handleStateChange}
            placeholder="e.g. Punjab, West Bengal..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {/* District Input */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              District Input
            </label>
            {geoDetails.districtCode ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                Code: {geoDetails.districtCode}
              </span>
            ) : districtInput ? (
              <span className="text-xs text-amber-600 font-medium">Unrecognized</span>
            ) : null}
          </div>
          <input
            type="text"
            value={districtInput}
            onChange={handleDistrictChange}
            placeholder="e.g. Ludhiana, Jaipur..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        {/* Block Code Input */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              Block Code (Input Remains Intact)
            </label>
            {geoDetails.blockCode ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                Code: {blockInput || geoDetails.blockCode}
              </span>
            ) : blockInput ? (
              <span className="text-xs text-amber-600 font-medium">Unrecognized code</span>
            ) : null}
          </div>
          <input
            type="text"
            value={blockInput}
            onChange={handleBlockChange}
            placeholder="e.g. LDH-01, ASR-02..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
          />
        </div>
      </div>

      {/* Real-time Code & Block Name Status Banner */}
      {(geoDetails.stateCode || geoDetails.districtCode || geoDetails.blockCode) && (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3 shadow-inner">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fetched Geo & Block Information</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded bg-indigo-50/70 p-2">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">State</span>
              <span className="font-semibold text-slate-800">{geoDetails.stateName || stateInput || 'N/A'}</span> ➔{' '}
              <span className="font-bold text-indigo-600">{geoDetails.stateCode || 'N/A'}</span>
            </div>
            <div className="rounded bg-emerald-50/70 p-2">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">District</span>
              <span className="font-semibold text-slate-800">{geoDetails.districtName || districtInput || 'N/A'}</span> ➔{' '}
              <span className="font-bold text-emerald-600">{geoDetails.districtCode || 'N/A'}</span>
            </div>
            <div className="rounded bg-purple-50/70 p-2">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Block Code & Auto-Fetched Name</span>
              <span className="font-mono font-bold text-purple-700">{blockInput || geoDetails.blockCode || 'N/A'}</span> ➔{' '}
              <span className="font-semibold text-slate-900">{geoDetails.blockName || 'Unresolved'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Preset Example Quick Buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Quick Test:</span>
        {presetExamples.map((ex) => (
          <button
            key={ex.state + ex.district + ex.block}
            type="button"
            onClick={() => {
              setStateInput(ex.state);
              setDistrictInput(ex.district);
              setBlockInput(ex.block);
              const details = fetchGeoDetails(ex.state, ex.district, ex.block);
              if (onAutoSelect) {
                onAutoSelect({ stateCode: details.stateCode, districtCode: details.districtCode, blockCode: details.blockCode, blockName: details.blockName });
              }
            }}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-purple-50 hover:text-purple-600"
          >
            Code: <b>{ex.block}</b> ➔ {ex.expectedBName} ({ex.state})
          </button>
        ))}
      </div>
    </div>
  );
};

