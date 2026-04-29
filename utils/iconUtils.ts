import iconConfig from '/public/assets/icons.yaml';

export const getTypeIcon = (type: string, iconMap: Record<string, any>) => {
  const t = type.toLowerCase().trim();
  
  if (iconConfig && iconConfig.mappings) {
    for (const mapping of iconConfig.mappings) {
      if (mapping.keywords.some((k: string) => t.includes(k))) {
        const IconComponent = iconMap[mapping.icon];
        if (IconComponent) {
          return { component: IconComponent, className: mapping.className };
        }
      }
    }
  }

  const DefaultIcon = iconMap[iconConfig?.default?.icon];
  const defaultClass = iconConfig?.default?.className || "text-slate-400";
  return { component: DefaultIcon, className: defaultClass };
};
