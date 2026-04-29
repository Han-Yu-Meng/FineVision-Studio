import React from 'react';
import { getTypeIcon } from '../utils/iconUtils';
import { ArrowRight, Image as ImageIcon, Box, Compass, Map, Move3d, Activity, Scan, Grid, Wind, MapPin, Type, Hash, ToggleLeft, Quote } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
  Image: ImageIcon,
  Box,
  Compass,
  Map,
  Move3d,
  Activity,
  Scan,
  Grid,
  Wind,
  MapPin,
  Type,
  Hash,
  ToggleLeft,
  Quote
};

const TypeIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 12 }) => {
    const { component: Icon, className } = getTypeIcon(type, iconMap);
    if (!Icon) return <Type size={size} className={className} />;
    return <Icon size={size} className={className} />;
};

export const ServiceBadge: React.FC<{ request?: string; response?: string }> = ({ request, response }) => {
    const reqParts = request ? request.split(',').map(s => s.trim()) : [];
    const resParts = response ? response.split(',').map(s => s.trim()) : [];
    
    if (reqParts.length === 0 && resParts.length === 0) return null;

    return (
        <div className="flex items-center gap-0.5 opacity-70 bg-white/50 dark:bg-black/20 px-1 rounded ml-2">
            {reqParts.map((t, i) => (
                <div key={`req-${i}`} title={`Req: ${t}`}><TypeIcon type={t} /></div>
            ))}
            {(reqParts.length > 0 || resParts.length > 0) && <ArrowRight size={8} className="mx-0.5 text-slate-400"/>}
            {resParts.map((t, i) => (
                <div key={`res-${i}`} title={`Res: ${t}`}><TypeIcon type={t} /></div>
            ))}
        </div>
    );
};

export const ActionBadge: React.FC<{ goal?: string; feedback?: string }> = ({ goal, feedback }) => {
    const goalParts = goal ? goal.split(',').map(s => s.trim()) : [];
    const feedbackParts = feedback ? feedback.split(',').map(s => s.trim()) : [];

    if (goalParts.length === 0 && feedbackParts.length === 0) return null;

    return (
        <div className="flex items-center gap-0.5 opacity-70 bg-white/50 dark:bg-black/20 px-1 rounded ml-2">
            {goalParts.map((t, i) => (
                <div key={`goal-${i}`} title={`Goal: ${t}`}><TypeIcon type={t} /></div>
            ))}
            {(goalParts.length > 0 || feedbackParts.length > 0) && <ArrowRight size={8} className="mx-0.5 text-slate-400"/>}
            {feedbackParts.map((t, i) => (
                <div key={`feedback-${i}`} title={`Feedback: ${t}`}><TypeIcon type={t} /></div>
            ))}
        </div>
    );
};

export { TypeIcon };
