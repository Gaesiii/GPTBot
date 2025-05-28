require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const express = require('express');

// ⚙️ Khởi động web server giữ app sống
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// 🤖 Khởi tạo bot Discord
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

async function handleMessage(message) {
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id)) return;

    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 10000);

    let conversation = [{
        role: 'system',
        content: `bạn tên là Hẹ Hẹ. bạn là một chatbot thân thiện`,
    }];

    try {
        const PrevMessages = await message.channel.messages.fetch({ limit: 10 });
        PrevMessages.reverse();
        PrevMessages.forEach(msg => {
            if (msg.author.bot && msg.author.id !== client.user.id) return;
            if (msg.content.startsWith(IGNORE_PREFIX)) return;
            const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
            const role = msg.author.id === client.user.id ? 'assistant' : 'user';
            conversation.push({ role, name: username, content: msg.content });
        });
    } catch (err) {
        console.error('⚠️ Không lấy được message cũ:', err.message);
    }

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
            await message.reply('❌ Không có phản hồi từ AI.');
        }
    } catch (error) {
        console.error('🚫 OpenAI Error:\n', error);
        await message.reply('❌ Thử lại sau tí đê , con AI trĩ rồi');
    } finally {
        clearInterval(sendTypingInterval);
    }
}

// Lắng nghe tin nhắn thật từ Discord
client.on('messageCreate', handleMessage);

// 🔄 Giả lập tin nhắn mỗi 10 phút để giữ server sống
setInterval(() => {
    const fakeMessage = {
        author: {
            bot: false,
            id: '1234567890',
            username: 'keepalive_user',
        },
        content: 'Bot ơi, bạn còn sống không?',
        channelId: CHANNELS[0],
        channel: {
            id: CHANNELS[0],
            sendTyping: () => {},
            messages: {
                fetch: async () => [],
            },
        },
        mentions: {
            users: {
                has: (id) => id === client.user.id,
            }
        },
        reply: async () => {},
    };

    console.log('🔁 Gửi tin nhắn giả lập giữ bot sống...');
    handleMessage(fakeMessage);
}, 10 * 60 * 1000); // 10 phút

// 🔐 Đăng nhập
client.login(process.env.TOKEN);
