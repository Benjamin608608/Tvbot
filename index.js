const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// 環境變數設定
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;
const ROLE_NAME = '阿直播呢'; // 要通知的身分組名稱

// 創建Discord客戶端
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// 儲存當前直播狀態
const streamingUsers = new Map();

// 冷卻時間設定（避免頻繁通知）
const COOLDOWN_TIME = 5 * 60 * 1000; // 5分鐘
const userCooldowns = new Map();

// 檢查用戶是否在冷卻時間內
function isOnCooldown(userId) {
    const lastNotified = userCooldowns.get(userId);
    if (!lastNotified) return false;
    
    const timePassed = Date.now() - lastNotified;
    return timePassed < COOLDOWN_TIME;
}

// 設定用戶冷卻時間
function setCooldown(userId) {
    userCooldowns.set(userId, Date.now());
}

// 獲取通知頻道
async function getNotificationChannel(guild) {
    // 如果有設定特定頻道，優先使用該頻道
    if (NOTIFICATION_CHANNEL_ID) {
        try {
            const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                console.log(`使用指定的通知頻道: ${channel.name}`);
                return channel;
            }
        } catch (error) {
            console.error('無法找到指定的通知頻道:', error);
        }
    }
    
    // 否則自動尋找合適的頻道
    const channelNames = ['一般', 'general', '通知', 'notifications', '大廳', 'lobby'];
    
    for (const name of channelNames) {
        const channel = guild.channels.cache.find(ch => 
            ch.name.toLowerCase().includes(name.toLowerCase()) && ch.isTextBased()
        );
        if (channel) {
            console.log(`自動找到通知頻道: ${channel.name}`);
            return channel;
        }
    }
    
    // 如果都找不到，使用第一個文字頻道
    const fallbackChannel = guild.channels.cache.find(channel => channel.isTextBased());
    if (fallbackChannel) {
        console.log(`使用備用頻道: ${fallbackChannel.name}`);
    }
    return fallbackChannel;
}

// 發送直播開始通知
async function sendStreamStartNotification(member, voiceChannel) {
    try {
        const guild = member.guild;
        const notificationChannel = await getNotificationChannel(guild);
        
        if (!notificationChannel) {
            console.error('找不到適合的通知頻道');
            return;
        }
        
        // 檢查冷卻時間
        if (isOnCooldown(member.id)) {
            console.log(`${member.displayName} 還在冷卻時間內，跳過通知`);
            return;
        }
        
        // 創建嵌入式通知訊息
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
        
        // 發送通知
        await notificationChannel.send({
            content: '<@&748599117512572988> 有人開始直播了！',
            embeds: [embed]
        });
        
        // 設定冷卻時間
        setCooldown(member.id);
        
        console.log(`已發送 ${member.displayName} 的直播通知`);
        
    } catch (error) {
        console.error('發送直播通知時發生錯誤:', error);
    }
}

// 發送直播結束通知
async function sendStreamEndNotification(member, voiceChannel) {
    try {
        const guild = member.guild;
        const notificationChannel = await getNotificationChannel(guild);
        
        if (!notificationChannel) return;
        
        // 簡單的結束通知
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
}

// Discord機器人事件
client.once('ready', () => {
    console.log(`直播通知機器人已登入: ${client.user.tag}`);
    console.log('正在監聽語音頻道的直播活動...');
    console.log(`通知身分組: ${ROLE_NAME}`);
    
    if (NOTIFICATION_CHANNEL_ID) {
        console.log(`設定的通知頻道ID: ${NOTIFICATION_CHANNEL_ID}`);
    } else {
        console.log('將自動尋找合適的通知頻道');
    }
});

// 監聽語音狀態變化
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return; // 忽略機器人
        
        // 檢查直播狀態變化
        const wasStreaming = oldState.streaming;
        const isStreaming = newState.streaming;
        
        // 如果開始直播
        if (!wasStreaming && isStreaming && newState.channel) {
            console.log(`${member.displayName} 開始在 ${newState.channel.name} 直播`);
            
            // 記錄直播狀態
            streamingUsers.set(member.id, {
                user: member,
                channel: newState.channel,
                startTime: new Date()
            });
            
            // 發送開始通知
            await sendStreamStartNotification(member, newState.channel);
        }
        
        // 如果停止直播
        if (wasStreaming && !isStreaming) {
            console.log(`${member.displayName} 停止直播`);
            
            const streamData = streamingUsers.get(member.id);
            if (streamData) {
                // 發送結束通知
                await sendStreamEndNotification(member, streamData.channel);
                
                // 移除直播狀態記錄
                streamingUsers.delete(member.id);
            }
        }
        
        // 如果直播中但離開語音頻道
        if (isStreaming && !newState.channel && oldState.channel) {
            console.log(`${member.displayName} 直播中離開語音頻道`);
            
            // 也視為停止直播
            await sendStreamEndNotification(member, oldState.channel);
            streamingUsers.delete(member.id);
        }
        
    } catch (error) {
        console.error('處理語音狀態更新時發生錯誤:', error);
    }
});

// 訊息指令處理
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.trim();
    
    if (content.startsWith('!')) {
        const command = content.slice(1).toLowerCase();
        
        switch (command) {
            case 'stream':
            case 'help':
                await message.reply(`🔴 **直播通知機器人使用說明**

**🎮 功能：**
• 自動監測語音頻道的直播活動
• 當有人開始分享畫面時自動 @everyone 通知
• 顯示直播者資訊和語音頻道

**📋 指令：**
• \`!streaming\` - 查看當前直播列表
• \`!test\` - 測試機器人狀態
• \`!help\` - 顯示此說明

**⚙️ 設定：**
• 同一人5分鐘內只會通知一次（避免騷擾）
• 自動尋找合適的通知頻道發送訊息`);
                break;
                
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
                
            case 'cooldown':
                // 檢查用戶冷卻狀態（管理員功能）
                if (message.member.permissions.has('Administrator')) {
                    const cooldownInfo = Array.from(userCooldowns.entries()).map(([userId, time]) => {
                        const member = message.guild.members.cache.get(userId);
                        const remaining = Math.max(0, COOLDOWN_TIME - (Date.now() - time));
                        return `${member?.displayName || userId}: ${Math.ceil(remaining / 60000)} 分鐘`;
                    }).join('\n');
                    
                    await message.reply(`⏰ **冷卻時間狀態：**\n${cooldownInfo || '無用戶在冷卻中'}`);
                }
                break;
        }
    }
});

// 錯誤處理
client.on('error', (error) => {
    console.error('Discord客戶端錯誤:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('未處理的Promise拒絕:', error);
});

process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
});

// 優雅關閉
process.on('SIGINT', () => {
    console.log('收到SIGINT信號，正在關閉機器人...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('收到SIGTERM信號，正在關閉機器人...');
    client.destroy();
    process.exit(0);
});

// 登入Discord
client.login(DISCORD_TOKEN);
