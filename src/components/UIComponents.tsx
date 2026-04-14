import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface SpinnerProps {
  text?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ text = 'Loading', color = 'cyan' }) => {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <Text color={color}>{frames[frame]}</Text>
      <Text> </Text>
      <Text>{text}</Text>
    </Box>
  );
};

interface ProgressBarProps {
  progress: number;
  width?: number;
  color?: string;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  width = 40,
  color = 'green',
  label,
}) => {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      <Box>
        <Text color={color}>{bar}</Text>
        <Text> </Text>
        <Text dimColor>{Math.round(progress)}%</Text>
      </Box>
    </Box>
  );
};

interface StatusProps {
  status: 'idle' | 'processing' | 'error' | 'success';
  message?: string;
}

export const Status: React.FC<StatusProps> = ({ status, message }) => {
  const statusConfig = {
    idle: { color: 'gray', symbol: '○' },
    processing: { color: 'cyan', symbol: '◐' },
    error: { color: 'red', symbol: '✗' },
    success: { color: 'green', symbol: '✓' },
  };

  const config = statusConfig[status];

  return (
    <Box alignItems="center">
      <Text color={config.color}>{config.symbol}</Text>
      <Text> </Text>
      <Text color={config.color}>{message || status}</Text>
    </Box>
  );
};

interface ToolCallDisplayProps {
  toolName: string;
  input: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  output?: string;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolName,
  input,
  status,
  output,
}) => {
  const borderColor = status === 'running' ? 'cyan' : status === 'success' ? 'green' : 'red';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1} marginY={1}>
      <Box>
        <Text bold color={borderColor}>{status === 'running' ? '→' : status === 'success' ? '✓' : '✗'}</Text>
        <Text> </Text>
        <Text bold>Tool: {toolName}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        <Text dimColor>Input:</Text>
        <Text>{JSON.stringify(input, null, 2)}</Text>
        {output && (
          <>
            <Text dimColor>Output:</Text>
            <Text>{output}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

interface HeaderProps {
  title: string;
  version?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, version = '0.1.0' }) => {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Text bold color="cyan" inverse>{` ${title} `}</Text>
      <Text dimColor>Version {version}</Text>
    </Box>
  );
};

interface DividerProps {
  char?: string;
  color?: string;
}

export const Divider: React.FC<DividerProps> = ({ char = '─', color = 'gray' }) => {
  return <Text color={color}>{char.repeat(80)}</Text>;
};
