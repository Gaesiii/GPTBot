require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const express = require('express');
const axios = require('axios'); // cần thêm axios để tự ping Express server

// 🚀 Mở server Express để Render giữ app luôn sống
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// 🤖 Bot Discord
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

    let conversation = [];
    conversation.push({
        role: 'system',
        content: `
        bạn tên là Hẹ Hẹ.
        bạn là một chatbot thân thiện
        `
    });

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

    try {
        const response = await openai.chat.completions.create({
            model: 'meta-llama/llama-4-scout:free',
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
        message.reply('❌ Thử lại sau tí đê , con AI trĩ rồi');
    } finally {
        clearInterval(sendTypingInterval);
    }
});

// 🌀 Ping chính Express server mỗi 4 phút để giữ app không bị sleep
setInterval(async () => {
    try {
        console.log('🌍 Ping chính Express...');
        await axios.get(`http://localhost:${PORT}/`);
    } catch (e) {
        console.error('❌ Lỗi khi tự ping Express:', e.message);
    }
}, 4 * 60 * 1000); // mỗi 4 phút

// 🔄 Ping OpenRouter mỗi 10 phút để giữ kết nối AI
setInterval(async () => {
    try {
        console.log('🔄 Gửi ping tới OpenRouter...');
        await openai.chat.completions.create({
            model: 'meta-llama/llama-4-scout:free',
            messages: [
                { role: 'system', content: 'ping giữ server sống' },
                { role: 'user', content: 'hello bạn còn sống không?' }
            ]
        });
        console.log('✅ Ping OpenRouter thành công!');
    } catch (err) {
        console.error('⚠️ Lỗi ping OpenRouter:', err.message);
    }
}, 10 * 60 * 1000); // mỗi 10 phút

// 🔐 Đăng nhập bot
client.login(process.env.TOKEN);
