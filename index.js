const { Client, GatewayIntentBits, EmbedBuilder } = require(‘discord.js’);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates
]
});

const streamingUsers = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000;
const userCooldowns = new Map();

function isOnCooldown(userId) {
const lastNotified = userCooldowns.get(userId);
if (!lastNotified) return false;

```
const timePassed = Date.now() - lastNotified;
return timePassed < COOLDOWN_TIME;
```

}

function setCooldown(userId) {
userCooldowns.set(userId, Date.now());
}

async function getNotificationChannel(guild) {
const channelNames = [‘一般’, ‘general’, ‘通知’, ‘notifications’, ‘大廳’, ‘lobby’];

```
for (const name of channelNames) {
    const channel = guild.channels.cache.find(ch => 
        ch.name.toLowerCase().includes(name.toLowerCase()) && ch.isTextBased()
    );
    if (channel) return channel;
}

return guild.channels.cache.find(channel => channel.isTextBased());
```

}

async function sendStreamStartNotification(member, voiceChannel) {
try {
const guild = member.guild;
const notificationChannel = await getNotificationChannel(guild);

```
    if (!notificationChannel) {
        console.error('找不到適合的通知頻道');
        return;
    }
    
    if (isOnCooldown(member.id)) {
        console.log(`${member.displayName} 還在冷卻時間內，跳過通知`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🔴 有人開始直播了！')
        .setDescription(`**${member.displayName}** 正在 **${voiceChannel.name}** 語音頻道中直播分享畫面`)
        .addFields(
            { name: '🎮 直播者', value: `<@${member.id}>`, inline: true },
            { name: '📢 語音頻道', value: voiceChannel.name, inline: true },
            { name: '👥 目前人數', value: `${voiceChannel.members.size} 人`, inline: true }
        )
        .setColor('#FF0000')
        .setThumbnail(member.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: '點擊加入語音頻道一起觀看！' });
    
    await notificationChannel.send({
        content: '@everyone 有人開始直播了！',
        embeds: [embed]
    });
    
    setCooldown(member.id);
    console.log(`已發送 ${member.displayName} 的直播通知`);
    
} catch (error) {
    console.error('發送直播通知時發生錯誤:', error);
}
```

}

async function sendStreamEndNotification(member, voiceChannel) {
try {
const guild = member.guild;
const notificationChannel = await getNotificationChannel(guild);

```
    if (!notificationChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle('⚫ 直播已結束')
        .setDescription(`**${member.displayName}** 的直播已結束`)
        .setColor('#808080')
        .setTimestamp();
    
    await notificationChannel.send({ embeds: [embed] });
    console.log(`已發送 ${member.displayName} 的直播結束通知`);
    
} catch (error) {
    console.error('發送直播結束通知時發生錯誤:', error);
}
```

}

client.once(‘ready’, () => {
console.log(`直播通知機器人已登入: ${client.user.tag}`);
console.log(‘正在監聽語音頻道的直播活動…’);
});

client.on(‘voiceStateUpdate’, async (oldState, newState) => {
try {
const member = newState.member || oldState.member;
if (!member || member.user.bot) return;

```
    const wasStreaming = oldState.streaming;
    const isStreaming = newState.streaming;
    
    if (!wasStreaming && isStreaming && newState.channel) {
        console.log(`${member.displayName} 開始在 ${newState.channel.name} 直播`);
        
        streamingUsers.set(member.id, {
            user: member,
            channel: newState.channel,
            startTime: new Date()
        });
        
        await sendStreamStartNotification(member, newState.channel);
    }
    
    if (wasStreaming && !isStreaming) {
        console.log(`${member.displayName} 停止直播`);
        
        const streamData = streamingUsers.get(member.id);
        if (streamData) {
            await sendStreamEndNotification(member, streamData.channel);
            streamingUsers.delete(member.id);
        }
    }
    
    if (isStreaming && !newState.channel && oldState.channel) {
        console.log(`${member.displayName} 直播中離開語音頻道`);
        await sendStreamEndNotification(member, oldState.channel);
        streamingUsers.delete(member.id);
    }
    
} catch (error) {
    console.error('處理語音狀態更新時發生錯誤:', error);
}
```

});

client.on(‘messageCreate’, async (message) => {
if (message.author.bot) return;

```
const content = message.content.trim();

if (content.startsWith('!')) {
    const command = content.slice(1).toLowerCase();
    
    switch (command) {
        case 'stream':
        case 'help':
            await message.reply(`🔴 **直播通知機器人使用說明**
```

**🎮 功能：**
• 自動監測語音頻道的直播活動
• 當有人開始分享畫面時自動 @everyone 通知
• 顯示直播者資訊和語音頻道

**📋 指令：**
• `!streaming` - 查看當前直播列表
• `!test` - 測試機器人狀態
• `!help` - 顯示此說明

**⚙️ 設定：**
• 同一人5分鐘內只會通知一次（避免騷擾）
• 自動尋找合適的通知頻道發送訊息`);
break;

```
        case 'streaming':
        case 'live':
            if (streamingUsers.size === 0) {
                await message.reply('📭 目前沒有人在直播');
                return;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔴 目前直播列表')
                .setColor('#FF0000')
                .setTimestamp();
            
            let description = '';
            streamingUsers.forEach((streamData, userId) => {
                const duration = Math.floor((Date.now() - streamData.startTime.getTime()) / 60000);
                description += `**${streamData.user.displayName}** 在 **${streamData.channel.name}**\n已直播 ${duration} 分鐘\n\n`;
            });
            
            embed.setDescription(description);
            await message.reply({ embeds: [embed] });
            break;
            
        case 'test':
            await message.reply('✅ 直播通知機器人正常運作中！正在監聽語音頻道的直播活動。');
            break;
    }
}
```

});

client.on(‘error’, (error) => {
console.error(‘Discord客戶端錯誤:’, error);
});

process.on(‘unhandledRejection’, (error) => {
console.error(‘未處理的Promise拒絕:’, error);
});

process.on(‘uncaughtException’, (error) => {
console.error(‘未捕獲的異常:’, error);
});

process.on(‘SIGINT’, () => {
console.log(‘收到SIGINT信號，正在關閉機器人…’);
client.destroy();
process.exit(0);
});

process.on(‘SIGTERM’, () => {
console.log(‘收到SIGTERM信號，正在關閉機器人…’);
client.destroy();
process.exit(0);
});

client.login(DISCORD_TOKEN);
