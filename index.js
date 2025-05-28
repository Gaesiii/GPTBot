require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
});

client.on('ready', () => {
    console.log('🤖 The bot is online!');
});

const IGNORE_PREFIX = '!';
const CHANNELS = ['1377213523372802048'];

const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

const MAX_DISCORD_MESSAGE_LENGTH = 2000;

function splitMessage(content, maxLength = MAX_DISCORD_MESSAGE_LENGTH) {
    const parts = [];
    let current = '';

    for (const line of content.split('\n')) {
        if ((current + line).length > maxLength) {
            parts.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current) parts.push(current);
    return parts;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id)) return;


    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 10000);

    // Khởi tạo lại mỗi lần có tin nhắn
    let conversation = []; 
    conversation.push({
    role: 'system',
    content: `
    bạn tên là Hẹ Hẹ.
    bạn là một chatbot thân thiện
    `
});

    // Lấy 10 tin nhắn gần nhất để tạo ngữ cảnh
    const PrevMessages = await message.channel.messages.fetch({ limit: 10 });
    PrevMessages.reverse(); 
    PrevMessages.forEach(msg => {
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;
        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
        if (msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content,
            });
            return;
        }
        conversation.push({
            role: 'user',
            name: username,
            content: msg.content,
        });
    });

    // Gọi API OpenRouter
    try {
        const response = await openai.chat.completions.create({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: conversation,
        });

        const reply = response.choices?.[0]?.message?.content;
        if (reply) {
            const chunks = splitMessage(reply);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            message.reply('❌ Không có phản hồi từ AI.');
        }
    } catch (error) {
        console.error('🚫 OpenAI Error:\n', error);

        clearInterval(sendTypingInterval);
        if (!response) {
            message.reply('❌ Thử lại sau tí đê , con AI trĩ rồi');
            return;
        }
        message.reply('⚠️ Lỗi khi gọi AI: ' + (error.message || 'Không rõ lỗi.'));

    }
});


client.login(process.env.TOKEN);
