
import React from 'react';
import { useViewport } from '@xyflow/react';

export const ViewportOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { x, y, zoom } = useViewport();
  
  return (
    <div 
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-50 origin-top-left"
      style={{
        transform: `translate(${x}px, ${y}px) scale(${zoom})`
      }}
    >
      {children}
    </div>
  );
};
