const { Client, GatewayIntentBits, EmbedBuilder } = require(‘discord.js’);

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates
]
});

const streamingUsers = new Map();

async function getNotificationChannel(guild) {
const channelNames = [‘一般’, ‘general’, ‘通知’, ‘大廳’];

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

async function sendStreamNotification(member, voiceChannel) {
try {
const guild = member.guild;
const notificationChannel = await getNotificationChannel(guild);

```
    if (!notificationChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle('🔴 有人開始直播了！')
        .setDescription(`**${member.displayName}** 正在 **${voiceChannel.name}** 直播`)
        .addFields(
            { name: '直播者', value: member.displayName, inline: true },
            { name: '語音頻道', value: voiceChannel.name, inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();
    
    await notificationChannel.send({
        content: '@everyone 有人開始直播了！',
        embeds: [embed]
    });
    
    console.log(`已發送 ${member.displayName} 的直播通知`);
    
} catch (error) {
    console.error('發送通知時發生錯誤:', error);
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
        console.log(`${member.displayName} 開始直播`);
        
        streamingUsers.set(member.id, {
            user: member,
            channel: newState.channel,
            startTime: new Date()
        });
        
        await sendStreamNotification(member, newState.channel);
    }
    
    if (wasStreaming && !isStreaming) {
        console.log(`${member.displayName} 停止直播`);
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

if (content === '!test') {
    await message.reply('✅ 直播通知機器人正常運作中！');
}

if (content === '!help') {
    await message.reply('🔴 **直播通知機器人**\n自動監測語音頻道的直播活動\n當有人開始分享畫面時會自動通知大家');
}
```

});

client.on(‘error’, (error) => {
console.error(‘Discord客戶端錯誤:’, error);
});

client.login(process.env.DISCORD_TOKEN);
