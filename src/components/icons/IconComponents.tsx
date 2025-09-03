import React from 'react';

// ============================================================================
// ICON COMPONENT INTERFACES
// ============================================================================

interface IconProps {
  size?: number | string;
  color?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

// ============================================================================
// CATEGORY ICONS
// ============================================================================

export const SocialMediaIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Social Media'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.5 6L12 10.5 8.5 8 12 5.5 15.5 8zM8.5 16L12 13.5 15.5 16 12 18.5 8.5 16z" 
      fill={color}
    />
  </svg>
);

export const EcommerceIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'E-commerce'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M7 4V2C7 1.45 7.45 1 8 1h8c.55 0 1 .45 1 1v2h4c.55 0 1 .45 1 1s-.45 1-1 1h-1v13c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6H3c-.55 0-1-.45-1-1s.45-1 1-1h4zm2-1v1h6V3H9zm-3 3v13h12V6H6zm2 2h8v2H8V8zm0 3h8v2H8v-2z" 
      fill={color}
    />
  </svg>
);

export const ProfessionalIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Professional'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" 
      fill={color}
    />
  </svg>
);

export const NewsIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'News & Content'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" 
      fill={color}
    />
  </svg>
);

export const ProductivityIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Productivity'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      fill={color}
    />
  </svg>
);

export const CustomIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Custom'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" 
      fill={color}
    />
  </svg>
);

export const WebsiteIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Website'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" 
      fill={color}
    />
  </svg>
);

// ============================================================================
// ACTION ICONS
// ============================================================================

export const EditIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Edit'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" 
      fill={color}
    />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Delete'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" 
      fill={color}
    />
  </svg>
);

export const DuplicateIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Duplicate'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" 
      fill={color}
    />
  </svg>
);

export const StatsIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Statistics'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" 
      fill={color}
    />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Copy'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4H8c-1.1 0-1.99.9-1.99 2L6 21c0 1.1.89 2 2 2h9c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h7v14z" 
      fill={color}
    />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Close'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" 
      fill={color}
    />
  </svg>
);

// ============================================================================
// STATUS ICONS
// ============================================================================

export const CheckIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Success'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" 
      fill={color}
    />
  </svg>
);

export const ErrorIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Error'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" 
      fill={color}
    />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Warning'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" 
      fill={color}
    />
  </svg>
);

export const LoadingIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Loading'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon loading-spin ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z" 
      fill={color}
    />
  </svg>
);

// ============================================================================
// NAVIGATION ICONS
// ============================================================================

export const FilterIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Filter'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" 
      fill={color}
    />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Search'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" 
      fill={color}
    />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Settings'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" 
      fill={color}
    />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Refresh'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" 
      fill={color}
    />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Play'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M8 5v14l11-7z" 
      fill={color}
    />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'Pause'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" 
      fill={color}
    />
  </svg>
);

export const AIIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = 'currentColor', 
  className = '', 
  onClick,
  title = 'AI Assistant'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" 
      fill={color}
    />
  </svg>
);

// ============================================================================
// PRIORITY ICONS
// ============================================================================

export const HighPriorityIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = '#ff4444', 
  className = '', 
  onClick,
  title = 'High Priority'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      fill={color}
    />
  </svg>
);

export const MediumPriorityIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = '#ffaa00', 
  className = '', 
  onClick,
  title = 'Medium Priority'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      fill={color}
    />
  </svg>
);

export const LowPriorityIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = '#4CAF50', 
  className = '', 
  onClick,
  title = 'Low Priority'
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={`icon ${className}`}
    onClick={onClick}
    title={title}
  >
    <circle cx="12" cy="12" r="8" fill={color} />
  </svg>
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getCategoryIcon = (category: string, props?: Partial<IconProps>) => {
  const iconProps = { size: 16, ...props };
  
  switch (category.toLowerCase()) {
    case 'social_media':
    case 'social media':
      return <SocialMediaIcon {...iconProps} />;
    case 'ecommerce':
    case 'e-commerce':
      return <EcommerceIcon {...iconProps} />;
    case 'professional':
      return <ProfessionalIcon {...iconProps} />;
    case 'news_content':
    case 'news & content':
      return <NewsIcon {...iconProps} />;
    case 'productivity':
      return <ProductivityIcon {...iconProps} />;
    case 'custom':
      return <CustomIcon {...iconProps} />;
    default:
      return <WebsiteIcon {...iconProps} />;
  }
};

export const getPriorityIcon = (priority: number, props?: Partial<IconProps>) => {
  const iconProps = { size: 16, ...props };
  
  if (priority > 10) {
    return <HighPriorityIcon {...iconProps} />;
  } else if (priority > 5) {
    return <MediumPriorityIcon {...iconProps} />;
  } else {
    return <LowPriorityIcon {...iconProps} />;
  }
};