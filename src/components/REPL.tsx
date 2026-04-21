import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useState } from 'react';

export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	toolName?: string;
	timestamp: Date;
}

interface REPLProps {
	messages: Message[];
	onSend: (message: string) => void;
	onCommand: (command: string) => void;
	isProcessing: boolean;
}

export const REPL: React.FC<REPLProps> = ({ messages, onSend, onCommand, isProcessing }) => {
	const [input, setInput] = useState('');

	useInput((input, key) => {
		if (key.return) {
			const trimmed = input.trim();
			if (trimmed) {
				if (trimmed.startsWith('/')) {
					onCommand(trimmed);
				} else {
					onSend(trimmed);
				}
				setInput('');
			}
		} else if (key.backspace) {
			setInput((prev) => prev.slice(0, -1));
		} else if (key.delete) {
			// Handled by backspace
		} else if (key.leftArrow) {
			// Cursor movement is not currently implemented in this simple REPL input.
		} else if (key.rightArrow) {
			// Cursor movement is not currently implemented in this simple REPL input.
		} else if (key.escape) {
			setInput('');
		} else if (input && !key.ctrl && !key.meta) {
			setInput((prev) => prev + input);
		}
	});

	const roleColor = (role: string) => {
		switch (role) {
			case 'user':
				return 'cyan';
			case 'assistant':
				return 'green';
			case 'tool':
				return 'yellow';
			case 'system':
				return 'magenta';
			default:
				return 'white';
		}
	};

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexDirection="column" flexGrow={1}>
				{messages.map((msg) => (
					<Box key={msg.id} flexDirection="column" marginY={1}>
						<Text bold color={roleColor(msg.role)}>
							{msg.role === 'user' ? 'You' : msg.role === 'tool' ? `[${msg.toolName}]` : 'Reo'}:
						</Text>
						<Box marginLeft={2}>
							<Text>{msg.content}</Text>
						</Box>
					</Box>
				))}
				{isProcessing && (
					<Box marginY={1}>
						<Text dimColor>Thinking...</Text>
					</Box>
				)}
			</Box>

			<Box borderStyle="round" borderColor="blue" marginY={1} paddingX={1}>
				<Text color="cyan">{'>'}</Text>
				<Text> </Text>
				<Text>{input}</Text>
				<Text> </Text>
			</Box>

			<Text dimColor>Type /help for commands, Enter to send, Ctrl+C to exit</Text>
		</Box>
	);
};

export default REPL;
