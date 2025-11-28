import React from 'react';

interface RetroSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  label: string;
  onLabel?: string;
  offLabel?: string;
}

export const RetroSwitch: React.FC<RetroSwitchProps> = ({ isOn, onToggle, label, onLabel = "ON", offLabel = "OFF" }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] text-gray-300 uppercase tracking-widest">{label}</span>
      <button
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${isOn ? 'bg-accent' : 'bg-gray-700'} shadow-inner border border-gray-800`}
      >
        <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-black/60 transition-opacity duration-200 ${isOn ? 'opacity-100' : 'opacity-0'}`}>{onLabel}</span>
        <span className={`absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-white/40 transition-opacity duration-200 ${!isOn ? 'opacity-100' : 'opacity-0'}`}>{offLabel}</span>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gradient-to-b from-gray-100 to-gray-300 shadow-md transform transition-transform duration-200 ${isOn ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};