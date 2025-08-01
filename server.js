const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// 加载 .env 文件中的环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
    AMap: {
        // 直接从环境变量获取 API_KEY。
        // 请务必在 .env 文件中设置 AMAP_API_KEY='您的高德Web服务API Key'。
        API_KEY: process.env.AMAP_API_KEY, 
        GEOCODE_API: 'https://restapi.amap.com/v3/geocode/geo',
        WEATHER_API: 'https://restapi.amap.com/v3/weather/weatherInfo',
        CITY_CODE: '310000', // 上海市的城市编码
    },
    SERVER: {
        RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15分钟
        RATE_LIMIT_MAX: 100, // 每个IP最多100次请求
        CACHE_TTL: 10 * 60 * 1000, // 10分钟缓存
    }
};

// **修正后的API Key检查：现在只检查是否为空或是否是初始的通用占位符**
// 这样即使您的真实Key在过去被用作了某个示例，也不会被错误地识别为“未配置”
if (!CONFIG.AMap.API_KEY || CONFIG.AMap.API_KEY === 'YOUR_AMAP_WEB_SERVICE_API_KEY') {
    console.error("\n=============================================");
    console.error("[严重错误] 高德地图Web服务API Key未配置或使用了默认占位符！");
    console.error("请在项目根目录的 .env 文件中设置 AMAP_API_KEY='您的高德Web服务API Key'。");
    console.error("这将导致后端API请求失败。服务器已自动退出以提醒您配置。");
    console.error("=============================================\n");
    process.exit(1); // 强制退出进程
}

// ========= 中间件配置 =========
// CORS 允许前端跨域请求
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
// 解析 JSON 请求体
app.use(express.json());
// HTTP 请求日志
app.use(morgan('dev'));

// 应用速率限制到 /api/ 路径，防止滥用
const apiLimiter = rateLimit({
    windowMs: CONFIG.SERVER.RATE_LIMIT_WINDOW,
    max: CONFIG.SERVER.RATE_LIMIT_MAX,
    message: { error: '请求过于频繁，请稍后重试。' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 静态文件服务 - 托管前端文件
app.use(express.static(path.join(__dirname, '/')));

// ========= API路由 =========
// 用于缓存高德API的响应，减少重复请求
const geocodeCache = new Map();
const weatherCache = new Map();

// 地理编码API路由：将地址转换为经纬度
app.get('/api/geocode', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: '查询参数 (query) 是必需的。' });
    }

    const cacheKey = `geocode:${query}`;
    if (geocodeCache.has(cacheKey) && (Date.now() - geocodeCache.get(cacheKey).timestamp < CONFIG.SERVER.CACHE_TTL)) {
        console.log(`[CACHE HIT] Geocode for: ${query}`);
        return res.json(geocodeCache.get(cacheKey).data);
    }

    try {
        console.log(`[API CALL] Geocode for: ${query}`);
        const response = await axios.get(CONFIG.AMap.GEOCODE_API, {
            params: { key: CONFIG.AMap.API_KEY, address: query, city: '上海' }
        });
        // 检查高德API是否返回了错误信息（例如：Key无效或权限不足）
        if (response.data.status === '0' && response.data.infocode !== '10000') {
            console.error('高德地理编码API返回错误:', response.data.info, ' infocode:', response.data.infocode);
            return res.status(403).json({ error: '高德地理编码API拒绝访问', details: response.data.info + ' (Infocode: ' + response.data.infocode + ')' });
        }
        geocodeCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        res.json(response.data);
    } catch (error) {
        console.error('地理编码API请求失败:', error.message);
        // 如果是axios错误，尝试获取更详细的错误响应
        if (error.response) {
            console.error('高德API响应数据:', error.response.data);
            console.error('高德API响应状态码:', error.response.status);
            res.status(error.response.status).json({ error: '未能获取地理编码数据。', details: error.response.data || error.message });
        } else {
            res.status(500).json({ error: '未能获取地理编码数据。', details: error.message });
        }
    }
});

// 天气API路由：获取上海市实时天气
app.get('/api/weather', async (req, res) => {
    const cacheKey = 'weather:shanghai'; // 字符串字面量需要用引号包围
    if (weatherCache.has(cacheKey) && (Date.now() - weatherCache.get(cacheKey).timestamp < CONFIG.SERVER.CACHE_TTL)) {
        console.log('[CACHE HIT] Weather for Shanghai');
        return res.json(weatherCache.get(cacheKey).data);
    }

    try {
        console.log(`[API CALL] Weather for Shanghai`);
        const response = await axios.get(CONFIG.AMap.WEATHER_API, {
            params: { key: CONFIG.AMap.API_KEY, city: CONFIG.AMap.CITY_CODE, extensions: 'base' } // 'base' 获取实时天气
        });
        // 检查高德API是否返回了错误信息（例如：Key无效或权限不足）
        if (response.data.status === '0' && response.data.infocode !== '10000') {
            console.error('高德天气API返回错误:', response.data.info, ' infocode:', response.data.infocode);
            return res.status(403).json({ error: '高德天气API拒绝访问', details: response.data.info + ' (Infocode: ' + response.data.infocode + ')' });
        }
        weatherCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        res.json(response.data);
    } catch (error) {
        console.error('天气API请求失败:', error.message);
        // 如果是axios错误，尝试获取更详细的错误响应
        if (error.response) {
            console.error('高德API响应数据:', error.response.data);
            console.error('高德API响应状态码:', error.response.status);
            res.status(error.response.status).json({ error: '未能获取天气数据。', details: error.response.data || error.message });
        } else {
            res.status(500).json({ error: '未能获取天气数据。', details: error.message });
        }
    }
});

// 健康检查路由
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date() }));

// 启动服务器
app.listen(PORT, () => {
    console.log(`
=============================================
天路智治 - 后端服务已启动
=============================================
- 状态: 运行中
- 端口: ${PORT}
- 访问: http://localhost:${PORT}
- API Key: ${CONFIG.AMap.API_KEY ? CONFIG.AMap.API_KEY.substring(0, 4) + '...' : '未配置'} (已加载)
=============================================
`);
});