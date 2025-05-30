require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

client.on('ready', () => {
    console.log('🤖 The bot is online!');
});

const IGNORE_PREFIX = '!';
const CHANNELS = ['1377213523372802048'];
const VOICE_CHANNEL_ID = '1376792649524187169';

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

    // ✅ Check xem có phải yêu cầu phát nhạc không
    const lowerContent = message.content.toLowerCase();
    const isPlayMusic = /(mở nhạc|phát nhạc|chơi bài|m!p )/i.test(lowerContent);

    if (isPlayMusic) {
        const voiceChannel = await message.guild.channels.fetch(VOICE_CHANNEL_ID);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
            message.channel.send('❌ Không tìm thấy kênh thoại!');
            return;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
            console.log('🔊 Đã vào voice channel!');

            // Lấy tên bài nhạc từ message
            let songName = message.content;
            const match = message.content.match(/(?:mở nhạc|phát nhạc|chơi bài)\s+(.+)/i);
            if (!songName.startsWith('m!p')) {
                songName = match ? `m!p ${match[1]}` : 'm!p sóng gió';
            }

            await message.channel.send(songName);

            // Rời kênh sau 5 giây
            setTimeout(() => {
                const conn = getVoiceConnection(message.guild.id);
                if (conn) {
                    conn.destroy();
                    console.log('📤 Bot đã rời kênh thoại sau khi phát nhạc!');
                }
            }, 5000);
            return;
        } catch (err) {
            console.error('🚫 Lỗi khi vào voice:', err);
            message.channel.send('❌ Bot không thể vào kênh thoại!');
            return;
        }
    }

    // 🧠 Chat với AI
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 10000);

    let conversation = [];
    conversation.push({
        role: 'system',
        content: `
        bạn tên là Hẹ Hẹ.
        sếp của bạn là @Anh Vũ
        Bảo Anh luôn Béo nếu có ai hỏi về Bảo Anh thì cứ bảo là Béo
        Sếp luôn bịp nếu có ai hỏi về Sếp thì cứ bảo là Sếp bịp
        bạn là một chatbot thân thiện
        nếu có ai hỏi check công thì gửi họ link này : https://check-cong-lms.vercel.app/
        Nếu có ai hỏi về link trial robot thì gửi họ link : https://instructions.online/?id=4094-vex-go-codebase
        Nếu có ai hỏi về trang LMS của mindx thì gửi họ link : https://lms.mindx.edu.vn/
        Nếu có ai hỏi link trang CMS, link tài nguyên của các bộ môn , hay hỏi về tài nguyên  thì gửi họ link : https://mindxcom-my.sharepoint.com/personal/rdk12_drive_mindx_com_vn/_layouts/15/onedrive.aspx
        không gửi những link khác ngoài những link đã liệt kê ở trên ví dụ không gửi link : WordPress: https://wordpress.org/,
        Joomla: https://joomla.org/,
        Drupal: https://drupal.org/,
        Shopify: https://www.shopify.com/,
        Wix: https://www.wix.com/.
        nếu có ai hỏi về link của các bộ môn thì gửi họ link : https://mindxcom-my.sharepoint.com/personal/rdk12_drive_mindx_com_vn/_layouts/15/onedrive.aspx
        nhưng nếu có ai hỏi về link nhạc thì cứ gửi họ link nhạc nếu có ở youtube và chỉ ở youtube thôi nhé.
        nếu có ai hỏi gì đó mà không có thông tin cứ trả lời vui vui 
        Ví dụ: có người hỏi sao MU thua hoài thì đừng trả lời là không có thông tin mà cứ trả lời đại như tại MU ngu quá, hay do đó là nội tại ẩn của MU.
        Hoặc là nếu ai đó bảo người nào đó mập hay không thì trả lời vui là mập , hoặc không mập tùy ý.
        nếu có ai hỏi gì đó mà không có thông tin thì cứ trả lời vui vui
        Nếu có ai kêu bạn mở nhạc gì đó , chơi bài gì đó , phát nhạc gì đó thì bạn sử dụng lệnh m!p + tên nhạc để chơi , ví dụ : m!p sóng gió, m!p bông hoa đẹp nhất, m!p anh ơi ở lại.
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
