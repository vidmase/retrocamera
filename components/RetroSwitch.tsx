import React from 'react';

interface RetroSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  label: string;
}

export const RetroSwitch: React.FC<RetroSwitchProps> = ({ isOn, onToggle, label }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] text-gray-300 uppercase tracking-widest">{label}</span>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${isOn ? 'bg-accent' : 'bg-gray-700'} shadow-inner border border-gray-800`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gradient-to-b from-gray-100 to-gray-300 shadow-md transform transition-transform duration-200 ${isOn ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );
};