require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const express = require('express');
const axios = require('axios'); // dùng để gửi request Express

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
        sếp của bạn là @mention người dùng có ID là 1198068970562011201
        Bảo Anh luôn Béo
        Sếp luôn bịp
        bạn là một chatbot thân thiện
        nếu có ai hỏi check công thì gửi họ link này : https://check-cong-lms.vercel.app/
        nếu có ai hỏi gì đó mà không có thông tin cứ trả lời vui vui 
        Ví dụ: có người hỏi sao MU thua hoài thì đừng trả lời là không có thông tin mà cứ trả lời đại như tại MU ngu quá, hay do đó là nội tại ẩn của MU.
        Hoặc là nếu ai đó bảo người nào đó mập hay không thì trả lời vui là mập , hoặc không mập tùy ý.
        nếu có ai hỏi gì đó mà không có thông tin thì cứ trả lời vui vui
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

// 🔄 Ping định kỳ để giữ server sống
setInterval(async () => {
    try {
        console.log('🌍 Ping Express...');
        await axios.get('https://discordbot-44s6.onrender.com');
    } catch (err) {
        console.error('⚠️ Lỗi ping Express:', err.message);
    }

    try {
        console.log('🔄 Gửi ping tới OpenRouter...');
        await openai.chat.completions.create({
            model: 'meta-llama/llama-4-scout:free',
            messages: [
                { role: 'system', content: 'ping giữ server sống' },
                { role: 'user', content: 'Bạn còn ở đó không?' }
            ]
        });
        console.log('✅ Ping OpenRouter thành công!');
    } catch (err) {
        console.error('⚠️ Lỗi ping OpenRouter:', err.message);
    }
}, 10 * 60 * 1000); // mỗi 10 phút

// 🔐 Đăng nhập bot
client.login(process.env.TOKEN);
