import { Box, Text } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { QueryEngine, createQueryEngine } from './QueryEngine.js';
import { globalCommandRegistry } from './commands/index.js';
import { setUsageProvider } from './commands/index.js';
import { type Message, REPL } from './components/REPL.js';
import { Header } from './components/UIComponents.js';
import { globalToolRegistry } from './tools/index.js';
import { VERSION } from './version';

interface AppProps {
	initialMessage?: string;
}

export const App: React.FC<AppProps> = ({ initialMessage }) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [engine] = useState(() => createQueryEngine());

	const handleSend = useCallback(
		async (content: string) => {
			const userMessage: Message = {
				id: `user-${Date.now()}`,
				role: 'user',
				content,
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, userMessage]);
			setIsProcessing(true);

			try {
				const tools = globalToolRegistry.getAll();
				const response = await engine.query(content, { tools });

				const assistantMessage: Message = {
					id: `assistant-${Date.now()}`,
					role: 'assistant',
					content: response,
					timestamp: new Date(),
				};

				setMessages((prev) => [...prev, assistantMessage]);
			} catch (error) {
				const errorMessage: Message = {
					id: `error-${Date.now()}`,
					role: 'system',
					content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, errorMessage]);
			} finally {
				setIsProcessing(false);
			}
		},
		[engine],
	);

	useEffect(() => {
		setUsageProvider(() => engine.getUsageStats());

		const systemMessage: Message = {
			id: 'system-welcome',
			role: 'system',
			content: 'Welcome to Reo Agent! I am an AI coding assistant. How can I help you today?',
			timestamp: new Date(),
		};
		setMessages([systemMessage]);

		if (initialMessage) {
			handleSend(initialMessage);
		}
	}, [engine, initialMessage, handleSend]);

	const handleCommand = useCallback(async (input: string) => {
		const parsed = globalCommandRegistry.parseInput(input);

		if (!parsed) {
			const errorMsg: Message = {
				id: `error-${Date.now()}`,
				role: 'system',
				content: `Unknown command: ${input}. Type /help for available commands.`,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMsg]);
			return;
		}

		const commandMsg: Message = {
			id: `command-${Date.now()}`,
			role: 'user',
			content: input,
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, commandMsg]);

		try {
			const result = await parsed.command.execute(parsed.args);

			if (result.type === 'text') {
				const responseMsg: Message = {
					id: `command-result-${Date.now()}`,
					role: 'system',
					content: result.content as string,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, responseMsg]);
			} else if (result.type === 'action' && result.content === 'clear') {
				setMessages([
					{
						id: 'system-cleared',
						role: 'system',
						content: 'Conversation cleared.',
						timestamp: new Date(),
					},
				]);
			}
		} catch (error) {
			const errorMsg: Message = {
				id: `error-${Date.now()}`,
				role: 'system',
				content: `Command error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMsg]);
		}
	}, []);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Header title="Reo Agent" version={VERSION} />
			<REPL
				messages={messages}
				onSend={handleSend}
				onCommand={handleCommand}
				isProcessing={isProcessing}
			/>
		</Box>
	);
};

export default App;
