// ========= 全局变量与DOM元素 =========
let map;
let placeSearch;
let departureMarker, destinationMarker; // 用于存储起点和终点标记
let activePolyline; // 用于存储当前绘制的路线 (飞行或地面)
let currentWeatherData = null; // 存储当前天气数据

const backToTopBtn = document.getElementById('backToTopBtn');
const header = document.getElementById('header');
const resultsContainer = document.getElementById('resultsContainer');
const groundServiceContainer = document.getElementById('groundServiceContainer');
const loadingState = document.getElementById('loadingState');
const errorMessageDiv = document.getElementById('errorMessage');
const successMessageDiv = document.getElementById('successMessage');
const warningMessageDiv = document.getElementById('warningMessage');

// 新增：导航栏和天气按钮/组件的DOM元素
const weatherBtn = document.getElementById('weatherBtn');
const weatherWidget = document.getElementById('weatherWidget');

// ========= 地图初始化 =========
const initMap = () => {
    if (!window.AMap) {
        console.error('高德地图SDK未加载');
        return;
    }
    map = new AMap.Map('map', {
        zoom: 10,
        center: [121.4737, 31.2304], // 上海市中心坐标
        city: '上海市', // 限定在上海市
        mapStyle: 'amap://styles/dark', // 暗色系地图样式
        features: ['bg', 'road', 'building'] // 显示背景、道路、建筑物
    });

    // 添加立体建筑物
    new AMap.Buildings({ zooms: [14, 20], heightFactor: 2 }).setMap(map);
    console.log('主页地图初始化完成');

    // 创建禁飞区
    createNoFlyZones();
};

const createNoFlyZones = () => {
    // 模拟上海市内的禁飞区，实际数据应从后端获取
    const noFlyZones = [
        // 陆家嘴金融中心高密度区 (示例)
        [[121.498, 31.234], [121.505, 31.234], [121.505, 31.240], [121.498, 31.240]],
        // 虹桥机场核心区 (示例)
        [[121.320, 31.180], [121.350, 31.180], [121.350, 31.210], [121.320, 31.210]],
        // 人民广场及周边 (示例)
        [[121.470, 31.220], [121.485, 31.220], [121.485, 31.235], [121.470, 31.235]],
    ];

    noFlyZones.forEach(path => {
        new AMap.Polygon({
            path,
            strokeColor: '#FF3B30', // 红色边框 (Danger Color)
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillColor: 'rgba(255, 59, 48, 0.25)', // 红色填充
            fillOpacity: 0.25,
            zIndex: 10,
            bubble: true,
            extData: { type: 'noFlyZone' }
        }).setMap(map);
    });
    console.log('禁飞区已绘制');
};


// ========= 地点搜索与自动完成 =========
const initPlaceSearch = () => {
    AMap.plugin('AMap.PlaceSearch', () => {
        placeSearch = new AMap.PlaceSearch({
            city: '上海市',
            citylimit: true,
            pageSize: 5
        });
        console.log('地点搜索插件初始化完成');
    });
};

const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    input.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        if (keyword.length < 2) {
            suggestions.style.display = 'none';
            return;
        }
        placeSearch.search(keyword, (status, result) => {
            suggestions.innerHTML = '';
            if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
                result.poiList.pois.forEach(poi => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = poi.name;
                    div.onclick = () => {
                        input.value = poi.name;
                        suggestions.style.display = 'none';
                    };
                    suggestions.appendChild(div);
                });
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
};

// ========= 天气获取与渲染 =========
const refreshWeather = async () => {
    try {
        const response = await fetch('/api/weather');
        const data = await response.json();

        if (data && data.lives && data.lives.length > 0) {
            currentWeatherData = data.lives[0];
            document.getElementById('weatherTemp').textContent = `${currentWeatherData.temperature}°C`;
            document.getElementById('weatherDesc').textContent = currentWeatherData.weather;
            document.getElementById('windSpeed').textContent = `${currentWeatherData.windpower} 级 / ${currentWeatherData.winddirection}`;
            document.getElementById('humidity').textContent = `${currentWeatherData.humidity}%`;
            document.getElementById('visibility').textContent = `-- km`;
            document.getElementById('pressure').textContent = `-- hPa`;

            let iconClass = 'fas fa-sun';
            if (currentWeatherData.weather.includes('雨')) iconClass = 'fas fa-cloud-rain';
            else if (currentWeatherData.weather.includes('云') || currentWeatherData.weather.includes('阴')) iconClass = 'fas fa-cloud';
            else if (currentWeatherData.weather.includes('雪')) iconClass = 'fas fa-snowflake';
            document.getElementById('weatherIcon').innerHTML = `<i class="${iconClass}"></i>`;
            document.getElementById('weatherUpdate').innerHTML = `刚刚更新 <button class="refresh-btn" onclick="refreshWeather()">🔄</button>`;
            console.log('天气数据刷新成功:', currentWeatherData);
        } else {
            console.error('未能获取到天气数据:', data);
            showMessage('error', '天气数据加载失败，请重试');
            document.getElementById('weatherTemp').textContent = `--°C`;
            document.getElementById('weatherDesc').textContent = `加载失败`;
            document.getElementById('weatherIcon').innerHTML = `<i class="fas fa-exclamation-circle"></i>`;
            document.getElementById('windSpeed').textContent = `-- m/s`;
            document.getElementById('humidity').textContent = `--%`;
            document.getElementById('visibility').textContent = `-- km`;
            document.getElementById('pressure').textContent = `-- hPa`;
        }
    } catch (error) {
        console.error('获取天气时出错:', error);
        showMessage('error', '获取天气失败，请检查网络或后端服务');
        document.getElementById('weatherTemp').textContent = `--°C`;
        document.getElementById('weatherDesc').textContent = `加载失败`;
        document.getElementById('weatherIcon').innerHTML = `<i class="fas fa-exclamation-circle"></i>`;
        document.getElementById('windSpeed').textContent = `-- m/s`;
        document.getElementById('humidity').textContent = `--%`;
        document.getElementById('visibility').textContent = `-- km`;
        document.getElementById('pressure').textContent = `-- hPa`;
    }
};

const switchForecast = (type) => {
    const hourlyTab = document.querySelector('.forecast-tab:nth-child(1)');
    const dailyTab = document.querySelector('.forecast-tab:nth-child(2)');
    const hourlyItems = document.getElementById('hourlyForecastItems');
    const dailyItems = document.getElementById('dailyForecastItems');

    if (type === 'hourly') {
        hourlyTab.classList.add('active');
        dailyTab.classList.remove('active');
        hourlyItems.style.display = 'grid';
        dailyItems.style.display = 'none';
        renderMockForecast('hourly');
    } else {
        dailyTab.classList.add('active');
        hourlyTab.classList.remove('active');
        hourlyItems.style.display = 'none';
        dailyItems.style.display = 'grid';
        renderMockForecast('daily');
    }
};

const renderMockForecast = (type) => {
    const container = type === 'hourly' ? document.getElementById('hourlyForecastItems') : document.getElementById('dailyForecastItems');
    container.innerHTML = '';

    const data = [];
    if (type === 'hourly') {
        for (let i = 0; i < 8; i++) {
            const hour = (new Date().getHours() + i) % 24;
            let weatherCondition = '晴';
            let temp = (20 + Math.random() * 8).toFixed(0);
            if (hour > 20 || hour < 6) weatherCondition = '多云';
            if (Math.random() > 0.8) weatherCondition = '小雨';
            data.push({ time: `${hour}时`, temp: `${temp}°C`, weather: weatherCondition });
        }
    } else { // daily
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            let weatherCondition = '晴';
            if (Math.random() > 0.6) weatherCondition = '多云';
            if (Math.random() > 0.8) weatherCondition = '阵雨';
            const minTemp = (15 + Math.random() * 5).toFixed(0);
            const maxTemp = (25 + Math.random() * 8).toFixed(0);
            data.push({ time: i === 0 ? '今天' : dayNames[date.getDay()], temp: `${minTemp}/${maxTemp}°C`, weather: weatherCondition });
        }
    }

    data.forEach(item => {
        let iconClass = 'fas fa-sun';
        if (item.weather.includes('雨')) iconClass = 'fas fa-cloud-rain';
        else if (item.weather.includes('云') || item.weather.includes('阴')) iconClass = 'fas fa-cloud';
        else if (item.weather.includes('雪')) iconClass = 'fas fa-snowflake';
        else if (item.weather.includes('阵')) iconClass = 'fas fa-cloud-showers-heavy';

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="forecast-time">${item.time}</div>
            <div class="forecast-icon"><i class="${iconClass}"></i></div>
            <div class="forecast-temp">${item.temp}</div>
        `;
        container.appendChild(forecastItem);
    });
};


const setupWeatherWidget = () => {
    // weatherBtn 和 weatherWidget 已经在全局声明

    weatherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        weatherWidget.classList.toggle('active');
        if (weatherWidget.classList.contains('active')) {
            refreshWeather(); // 展开时刷新天气
            switchForecast('hourly'); // 默认显示小时预报
        }
    });

    weatherWidget.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
        if (!weatherBtn.contains(e.target) && !weatherWidget.contains(e.target)) {
            weatherWidget.classList.remove('active');
        }
    });
};

// ========= 核心功能：提交表单与空地协同决策 =========
const submitForm = async () => {
    const departureName = document.getElementById('departure').value;
    const destinationName = document.getElementById('destination').value;
    const preferredMode = document.getElementById('drone-type').value;

    if (!departureName || !destinationName) {
        showMessage('error', '请输入有效的出发地和目的地');
        return;
    }

    loadingState.style.display = 'flex';
    resultsContainer.style.display = 'none';
    groundServiceContainer.style.display = 'none';

    // 清除旧的地图元素
    if (departureMarker) map.remove(departureMarker);
    if (destinationMarker) map.remove(destinationMarker);
    if (activePolyline) map.remove(activePolyline);
    departureMarker = null;
    destinationMarker = null;
    activePolyline = null;

    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        // 1. 获取出发地和目的地坐标
        const [departureGeocode, destinationGeocode] = await Promise.all([
            fetch(`/api/geocode?query=${encodeURIComponent(departureName)}`).then(res => res.json()),
            fetch(`/api/geocode?query=${encodeURIComponent(destinationName)}`).then(res => res.json())
        ]);

        const departureLocation = departureGeocode.geocodes && departureGeocode.geocodes[0] ?
            departureGeocode.geocodes[0].location.split(',') : null;
        const destinationLocation = destinationGeocode.geocodes && destinationGeocode.geocodes[0] ?
            destinationGeocode.geocodes[0].location.split(',') : null;

        if (!departureLocation || !destinationLocation) {
            showMessage('error', '未能识别出发地或目的地，请检查输入');
            loadingState.style.display = 'none';
            groundServiceContainer.style.display = 'block';
            document.getElementById('flightDeniedReason').textContent = '未能识别您的出发地或目的地，请重新输入或尝试地面交通。';
            return;
        }

        const departureCoords = [parseFloat(departureLocation[0]), parseFloat(departureLocation[1])];
        const destinationCoords = [parseFloat(destinationLocation[0]), parseFloat(destinationLocation[1])];

        // 添加新的出发地和目的地标记
        departureMarker = new AMap.Marker({
            position: departureCoords,
            map: map,
            title: departureName,
            icon: 'https://webapi.amap.com/theme/v1.3/markers/n/start.png'
        });
        destinationMarker = new AMap.Marker({
            position: destinationCoords,
            map: map,
            title: destinationName,
            icon: 'https://webapi.amap.com/theme/v1.3/markers/n/end.png'
        });
        map.setFitView([departureMarker, destinationMarker]);


        // 2. 决策逻辑：是否可以飞行？
        let isFlightFeasible = true;
        let flightDenialReason = '';
        let weatherInfluence = '当前飞行路径气象条件良好。';

        // 优先检查用户是否强制选择地面交通
        if (preferredMode === 'ground') {
            isFlightFeasible = false;
            flightDenialReason = '您已选择地面交通优先。';
        } else if (currentWeatherData) {
            const windPower = parseFloat(currentWeatherData.windpower);
            const weather = currentWeatherData.weather;

            if (windPower > 6 || weather.includes('雨') || weather.includes('雪') || weather.includes('霾') || weather.includes('雾')) {
                isFlightFeasible = false;
                flightDenialReason = `恶劣天气：当前风力 ${windPower} 级，有 ${weather}。不建议飞行。`;
                weatherInfluence = `当前天气：风力 ${windPower} 级，有 ${weather}。不适宜飞行。`;
            }

            const simulatedNoFlyZoneInterference = Math.random() < 0.2;
            if (isFlightFeasible && simulatedNoFlyZoneInterference) {
                isFlightFeasible = false;
                flightDenialReason = `空域受限：检测到航线途经临时禁飞区或受管制空域。`;
            }

            const simulatedOtherIssue = Math.random() < 0.1;
            if (isFlightFeasible && simulatedOtherIssue) {
                isFlightFeasible = false;
                flightDenialReason = `系统评估：当前空域交通密度较高，或飞行器系统检测到潜在风险。`;
            }

        } else {
            isFlightFeasible = false;
            flightDenialReason = '无法获取实时天气数据，无法进行飞行评估。请刷新天气或选择地面交通。';
            showMessage('warning', flightDenialReason);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        loadingState.style.display = 'none';

        if (isFlightFeasible) {
            showMessage('success', '已生成推荐飞行方案！');
            resultsContainer.style.display = 'block';
            groundServiceContainer.style.display = 'none';

            const pathCoords = [departureCoords, destinationCoords];
            const midLat = (departureCoords[1] + destinationCoords[1]) / 2;
            const midLng = (departureCoords[0] + destinationCoords[0]) / 2;
            pathCoords.splice(1, 0, [midLng + (Math.random() - 0.5) * 0.03, midLat + (Math.random() - 0.5) * 0.03]);

            activePolyline = new AMap.Polyline({
                path: pathCoords,
                strokeColor: '#007AFF', // 飞行路径使用苹果蓝
                strokeWeight: 6,
                strokeOpacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                showDir: true,
                zIndex: 50
            });
            activePolyline.setMap(map);

            const distance = AMap.GeometryUtil.distance(departureCoords, destinationCoords);
            const flightTime = (distance / 1000 / 300 * 60).toFixed(0);

            document.getElementById('flightTime').textContent = flightTime;
            document.getElementById('flightDistance').textContent = (distance / 1000).toFixed(1);
            document.getElementById('safetyRating').textContent = `${(90 + Math.random() * 9).toFixed(0)}分 - 高度安全`;
            document.getElementById('weatherInfluence').textContent = weatherInfluence;
            document.getElementById('optimalAltitude').textContent = `巡航高度：${(200 + Math.random() * 200).toFixed(0)}米`;
            document.getElementById('airspaceStatus').textContent = `航线空域正常，无管制，预计畅通。`;

            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

            localStorage.setItem('currentRoutePath', JSON.stringify(pathCoords));
            localStorage.setItem('currentRouteType', 'flight');

        } else {
            showMessage('warning', '当前不建议飞行，已推荐地面出行方案。');
            groundServiceContainer.style.display = 'block';
            resultsContainer.style.display = 'none';

            document.getElementById('flightDeniedReason').textContent = flightDenialReason;

            AMap.plugin('AMap.Driving', async () => {
                const driving = new AMap.Driving({
                    map: map,
                    panel: null
                });

                driving.search(new AMap.LngLat(departureCoords[0], departureCoords[1]), new AMap.LngLat(destinationCoords[0], destinationCoords[1]), (status, result) => {
                    if (status === 'complete' && result.routes && result.routes.length) {
                        const route = result.routes[0];
                        const duration = route.time;
                        const distance = route.distance;
                        const taxiPrice = (distance / 1000 * (8 + Math.random() * 5)).toFixed(1);

                        document.getElementById('taxiTime').textContent = `${Math.ceil(duration / 60)}`;
                        document.getElementById('taxiPrice').textContent = `${taxiPrice}`;

                        const groundPathCoords = [];
                        route.steps.forEach(step => {
                            step.path.forEach(p => {
                                groundPathCoords.push([p.lng, p.lat]);
                            });
                        });

                        activePolyline = new AMap.Polyline({
                            path: groundPathCoords,
                            strokeColor: '#FFCC00', // 地面路径使用苹果黄
                            strokeWeight: 6,
                            strokeOpacity: 0.9,
                            lineJoin: 'round',
                            lineCap: 'round',
                            showDir: true,
                            zIndex: 40
                        });
                        activePolyline.setMap(map);
                        map.setFitView();

                        localStorage.setItem('currentRoutePath', JSON.stringify(groundPathCoords));
                        localStorage.setItem('currentRouteType', 'ground');

                    } else {
                        console.error('高德驾车路径规划失败:', result);
                        document.getElementById('taxiTime').textContent = `--`;
                        document.getElementById('taxiPrice').textContent = `--`;
                        showMessage('error', '无法规划地面路线，请稍后再试。');
                    }
                });
            });

            groundServiceContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('出行方案生成失败:', error);
        showMessage('error', `出行方案生成失败: ${error.message || '未知错误'}`);
        loadingState.style.display = 'none';
        groundServiceContainer.style.display = 'block';
        document.getElementById('flightDeniedReason').textContent = `系统错误或网络问题，无法生成出行方案。请稍后再试。`;
    }
};

// ========= 特殊服务/观光旅游路线展示 =========
const showSpecialRoute = (type) => {
    let routeName = '';
    let routeColor = '#34C759'; // 观光路线颜色 (苹果绿)
    let mockPath = [];

    if (departureMarker) map.remove(departureMarker);
    if (destinationMarker) map.remove(destinationMarker);
    if (activePolyline) map.remove(activePolyline);
    departureMarker = null;
    destinationMarker = null;
    activePolyline = null;


    if (type === 'sightseeing') {
        routeName = '上海城市观光路线';
        mockPath = [
            [121.498, 31.237], // 外滩附近
            [121.505, 31.238], // 东方明珠附近
            [121.512, 31.229], // 陆家嘴中心
            [121.470, 31.230], // 人民广场附近
            [121.480, 31.250]  // 苏州河沿岸
        ];
    } else if (type === 'business') {
        routeName = '虹桥机场-陆家嘴商务快线';
        routeColor = '#5856D6'; // 类似苹果的紫色
        mockPath = [
            [121.350, 31.190], // 虹桥机场
            [121.400, 31.205],
            [121.450, 31.220],
            [121.500, 31.235] // 陆家嘴
        ];
    } else if (type === 'cargo') {
        routeName = '浦东物流中心-外高桥货运专线';
        routeColor = '#5AC8FA'; // 类似苹果的浅蓝
        mockPath = [
            [121.560, 31.100], // 浦东机场附近
            [121.600, 31.150],
            [121.600, 31.300],
            [121.540, 31.350] // 外高桥港
        ];
    }

    if (mockPath.length > 0) {
        activePolyline = new AMap.Polyline({
            path: mockPath,
            strokeColor: routeColor,
            strokeWeight: 7,
            strokeOpacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
            showDir: true,
            zIndex: 60
        });
        activePolyline.setMap(map);
        map.setFitView();
        showMessage('success', `已在地图上展示“${routeName}”路线！`);

        new AMap.Marker({ position: mockPath[0], map: map, title: '起点', icon: 'https://webapi.amap.com/theme/v1.3/markers/n/start.png' });
        new AMap.Marker({ position: mockPath[mockPath.length - 1], map: map, title: '终点', icon: 'https://webapi.amap.com/theme/v1.3/markers/n/end.png' });

        localStorage.setItem('currentRoutePath', JSON.stringify(mockPath));
        localStorage.setItem('currentRouteType', type);

    } else {
        showMessage('error', '未能生成特殊路线。');
    }
};


// ========= UI/UX 辅助函数 =========
let lastScrollY = 0; // 用于记录上一次的滚动位置

const handleScroll = () => {
    // 回到顶部按钮逻辑
    if (backToTopBtn) {
        backToTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    }

    // 导航栏隐藏/显示逻辑
    const currentScrollY = window.scrollY;
    const headerHeight = header.offsetHeight; // 获取导航栏高度

    // 定义隐藏/显示阈值，避免频繁闪烁
    const scrollThreshold = 50; 

    if (currentScrollY > headerHeight + scrollThreshold && currentScrollY > lastScrollY) {
        // 向下滚动，且滚动距离超过导航栏高度 + 阈值，则隐藏导航栏
        header.classList.add('header-hidden');
        // 同时调整天气按钮和组件的 top 值，使其不会被隐藏的导航栏遮挡，且位置更紧凑
        weatherBtn.style.top = '20px'; /* 隐藏后离顶部更近 */
        weatherWidget.style.top = '70px'; /* 隐藏后离顶部更近 */
    } else if (currentScrollY < lastScrollY - scrollThreshold || currentScrollY <= 0) {
        // 向上滚动，或者回到了顶部，且滚动距离超过阈值，则显示导航栏
        header.classList.remove('header-hidden');
        // 恢复天气按钮和组件的默认 top 值
        weatherBtn.style.top = '35px'; /* 显示后恢复默认位置 */
        weatherWidget.style.top = '100px'; /* 显示后恢复默认位置 */
    }
    lastScrollY = currentScrollY; // 更新上一次滚动位置
};

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const smoothScrollTo = (selector) => {
    const element = document.querySelector(selector);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
};

const showMessage = (type, message) => {
    errorMessageDiv.style.display = 'none';
    successMessageDiv.style.display = 'none';
    warningMessageDiv.style.display = 'none';

    let targetDiv;
    if (type === 'error') {
        targetDiv = errorMessageDiv;
    } else if (type === 'success') {
        targetDiv = successMessageDiv;
    } else if (type === 'warning') {
        targetDiv = warningMessageDiv;
    } else {
        return;
    }

    targetDiv.textContent = message;
    targetDiv.style.display = 'block';

    setTimeout(() => {
        targetDiv.style.display = 'none';
    }, 4000);
};


// ========= 页面入口与事件绑定 =========
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initPlaceSearch();
    setupAutocomplete('departure', 'departureSuggestions');
    setupAutocomplete('destination', 'destinationSuggestions');
    setupWeatherWidget();
    refreshWeather();

    window.addEventListener('scroll', handleScroll);
    if (backToTopBtn) backToTopBtn.addEventListener('click', scrollToTop);

    // 平滑滚动到锚点 (包括新增的 #explore)
    document.querySelectorAll('.nav a[href^="#"], .cta-buttons a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            if (this.getAttribute('target') !== '_blank') {
                e.preventDefault();
                smoothScrollTo(this.getAttribute('href'));
            }
        });
    });

    renderMockForecast('hourly');
});