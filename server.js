/**
 * 公平竞争审查在线工具
 * 服务器端代码
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const docx = require('docx');
const cors = require('cors');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle } = docx;
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*', // 在开发阶段可以设为'*'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// 安全中间件
app.use((req, res, next) => {
    // 设置安全相关的HTTP头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self' https://cdn.jsdelivr.net;");
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// 配置文件上传
const storage = multer.memoryStorage(); // 使用内存存储代替磁盘存储

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/pdf', // .pdf
        'text/plain' // .txt
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型'), false);
    }
};

const upload = multer({
    storage,
    limits: { 
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 默认10MB
    },
    fileFilter
});

// 路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加健康检查API
app.get('/api/health', (req, res) => {
    // 检查环境变量
    const hasApiKey = !!process.env.SILICONFLOW_API_KEY;
    
    // 返回服务器健康状态
    res.json({
        status: 'ok',
        serverTime: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        apiKey: hasApiKey ? '已配置' : '未配置',
        version: '2.3.1'
    });
});

// 文件上传和审查接口
app.post('/api/review', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }

        console.log('收到文件上传请求:', req.file.originalname);
        
        // 调用DeepSeek API进行审查
        console.log('开始调用DeepSeek API进行审查');
        let reviewResults;
        try {
            reviewResults = await performReview(req);
            console.log('审查完成，结果:', JSON.stringify(reviewResults, null, 2));
        } catch (apiError) {
            console.error('API调用失败，详细错误:', apiError);
            // 返回明确的错误，而不是默默地使用模拟数据
            return res.status(500).json({ 
                error: '调用API失败',
                message: apiError.message,
                // 直接返回一个空结果，而不是模拟数据
                results: { totalIssues: 0, issues: [], error: true }
            });
        }
        
        // 使用内存存储后无需删除文件
        // 之前的fs.unlinkSync(req.file.path)代码已移除
        
        // 返回审查结果
        res.json(reviewResults);
    } catch (error) {
        console.error('审查过程中出错:', error);
        
        // 使用内存存储后无需删除文件
        // 之前的删除文件代码已移除
        
        // 返回友好的错误信息
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || '服务器内部错误';
        
        res.status(statusCode).json({ error: errorMessage });
    }
});

// 生成报告接口
app.post('/api/generate-report', async (req, res) => {
    try {
        const { fileName, reviewResults } = req.body;
        
        if (!reviewResults || !reviewResults.issues || !Array.isArray(reviewResults.issues)) {
            return res.status(400).json({ error: '缺少有效的审查结果数据' });
        }
        
        // 验证文件名
        const sanitizedFileName = sanitizeFileName(fileName || '未命名文件');
        
        // 生成Word文档
        const doc = generateWordReport(sanitizedFileName, reviewResults);
        const buffer = await Packer.toBuffer(doc);
        
        // 设置响应头
        res.setHeader('Content-Disposition', `attachment; filename="公平竞争审查报告_${new Date().toISOString().slice(0, 10)}.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        
        // 发送文档
        res.send(buffer);
    } catch (error) {
        console.error('生成报告时出错:', error);
        
        // 返回友好的错误信息
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || '服务器内部错误';
        
        res.status(statusCode).json({ error: errorMessage });
    }
});

// 从文件中提取文本 - 修改为处理内存中的文件
async function extractTextFromFile(file) {
    // 文件扩展名检测
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    try {
        switch (fileExt) {
            case '.docx':
                // 使用mammoth从内存中的Word文档提取文本
                const result = await mammoth.extractRawText({ 
                    buffer: file.buffer // 使用buffer而非文件路径
                });
                return result.value;
                
            case '.pdf':
                // 使用pdf-parse从内存中的PDF提取文本
                const pdfData = await pdfParse(file.buffer); // 直接使用buffer
                return pdfData.text;
                
            case '.txt':
                // 直接返回buffer内容
                return file.buffer.toString('utf8');
                
            default:
                throw createError(400, '不支持的文件类型');
        }
    } catch (error) {
        console.error('提取文本时出错:', error);
        throw createError(500, `提取文本时出错: ${error.message}`);
    }
}

// 调用DeepSeek API进行审查
async function performReview(req) {
    // 添加这一行标识当前代码版本
    console.log('【版本标识】使用硅基流动DeepSeek-R1接口 v2.3 - Vercel增强版');
    
    try {
        console.log('开始文件审查过程');
        
        // 提取文件内容
        const fileContent = await extractTextFromFile(req.file);
        console.log(`提取的文件内容长度: ${fileContent.length} 字符`);
        console.log(`文件内容预览: ${fileContent.substring(0, 100)}...`);
        
        // 检查环境变量
        console.log('检查API环境变量...');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('是否存在API密钥环境变量:', process.env.SILICONFLOW_API_KEY ? '是' : '否');
        
        // 获取API密钥 - 确保不用过期密钥
        let apiKey;
        if (process.env.SILICONFLOW_API_KEY) {
            apiKey = process.env.SILICONFLOW_API_KEY;
            console.log('使用环境变量中的API密钥');
        } else {
            // 注意：此处使用的是默认密钥，可能需要更新
            apiKey = 'sk-ndqddvkvqsfrvirhauqtrjejiwfawokxzakscpieqelbuhik';
            console.log('警告：使用默认API密钥，这可能在生产环境中不起作用');
        }
        
        // 修改API URL为硅基流动地址
        const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        
        // 请保留系统提示词内容...
        const systemPrompt = `你是一个专业的公平竞争审查专家，负责审查文件中可能存在的限制竞争问题，并给出专业修改建议。

你需要基于以下标准审查文件：
1. 《公平竞争审查制度实施细则》
2. 《反垄断法》相关规定
3. 公平竞争法律法规

在审查时，重点关注以下几类问题：
- 市场准入和退出限制
- 商品和要素自由流动限制
- 影响生产经营成本的问题
- 影响生产经营行为的问题

请严格按照以下格式组织你的回答：
# 问题1：[问题标题]
**问题描述：**  
[详细问题描述]

**原文引用：**  
"[从原文中精确引用问题段落]"

**违反条款：**  
违反[具体条款名称]第[N]条"[条款内容]"。

**修改建议：**  
[具体修改建议]

---------------------------------------------

按此格式提供所有发现的问题。如果没有发现问题，请说明文档符合公平竞争要求。

在分析中请重点关注以下类型的问题：
1. 差别待遇：对不同市场主体采取差异化政策
2. 排除限制：限制或者排斥市场主体公平竞争
3. 地方保护：设置地方壁垒，限制外地企业和产品
4. 指定交易：强制或变相强制交易主体选择特定对象
5. 附加不合理条件：设置不必要的条件增加市场主体负担

我会根据上述标准，对文件进行审查，评估其是否存在限制竞争的问题，并提供修改建议。`;

        const userPrompt = `请帮我审查以下政府文件是否存在限制竞争问题，找出所有疑似问题并给出修改建议：

${fileContent}`;

        console.log('构建API请求...');
        
        // 尝试不同的模型
        const models = [
            "Pro/deepseek-ai/DeepSeek-R1",
            "Pro/Qwen/Qwen2.5-7B-Instruct",
            "Pro/01-ai/Yi-VL-34B"
        ];
        
        console.log('可用模型列表:', models.join(', '));
        const modelToUse = global.availableModel || models[0];
        console.log(`选择模型: ${modelToUse}`);
        
        // 构建请求体
        const requestBody = {
            model: modelToUse,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
            top_p: 0.95,
            max_tokens: 4000,
            stream: false  // 设置为false，以获取完整响应
        };
        
        // 设置请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        // 打印完整请求信息(删除敏感信息)
        const debugRequestBody = JSON.parse(JSON.stringify(requestBody));
        debugRequestBody.messages[1].content = '内容已省略...';
        console.log('请求体:', JSON.stringify(debugRequestBody, null, 2));
        console.log('请求头:', {
            'Content-Type': headers['Content-Type'],
            'Authorization': 'Bearer sk-***' // 隐藏实际API密钥
        });
        
        console.log('发送请求到硅基流动API...');
        console.log(`使用的API密钥前缀: ${apiKey.substring(0, 5)}...`);
        console.log(`使用的模型: ${modelToUse}`);
        
        let response;
        try {
            // 发送请求
            const startTime = Date.now();
            response = await axios.post(apiUrl, requestBody, { 
                headers,
                // 添加超时设置，避免请求挂起太久
                timeout: 120000,
                // 不自动验证状态码，我们将手动处理
                validateStatus: null
            });
            const endTime = Date.now();
            
            console.log(`API响应时间: ${endTime - startTime}ms`);
            console.log('API响应状态:', response.status);
            console.log('API响应内容类型:', response.headers ? response.headers['content-type'] : 'unknown');
        } catch (error) {
            // 处理请求错误
            console.error('请求API时发生错误:', error.message);
            
            // 添加更详细的网络错误信息
            if (error.code) {
                console.error('网络错误代码:', error.code);
            }
            
            if (error.config) {
                console.error('请求配置:', {
                    url: error.config.url,
                    method: error.config.method,
                    timeout: error.config.timeout
                });
            }
            
            let detailedError = '调用API失败';
            
            if (error.response) {
                // 服务器返回了错误状态码
                console.error('API错误详情:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers,
                    data: error.response.data
                });
                
                // 格式化错误消息
                detailedError += `: ${error.response.status} - `;
                
                if (typeof error.response.data === 'string') {
                    detailedError += error.response.data.substring(0, 100);
                } else if (typeof error.response.data === 'object' && error.response.data !== null) {
                    detailedError += JSON.stringify(error.response.data).substring(0, 100);
                } else {
                    detailedError += error.response.statusText || '未知错误';
                }
            } else if (error.request) {
                // 请求已发出但没有收到响应
                console.error('未收到API响应:', error.request._currentUrl || '无URL信息');
                detailedError += ': 请求超时或无响应';
            } else {
                // 设置请求时发生了错误
                console.error('API请求配置错误:', error.message);
                detailedError += `: ${error.message}`;
            }
            
            throw new Error(detailedError);
        }
        
        // 检查响应状态
        if (!response || response.status !== 200) {
            // 记录详细错误信息
            console.error('API响应错误:', {
                status: response ? response.status : 'unknown',
                statusText: response ? response.statusText : 'unknown',
                data: response ? response.data : 'no response'
            });
            
            // 格式化错误消息
            let errorMsg = `API错误: ${response ? response.status : 'unknown'}`;
            
            // 尝试从响应中提取错误信息
            if (response && response.data) {
                if (typeof response.data === 'string') {
                    errorMsg += ' - ' + response.data.substring(0, 100);
                } else if (typeof response.data === 'object') {
                    errorMsg += ' - ' + (response.data.error || response.data.message || JSON.stringify(response.data).substring(0, 100));
                }
            }
            
            throw new Error(errorMsg);
        }
        
        // 确保响应包含所需字段
        if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
            console.error('无效的API响应格式:', response.data);
            throw new Error('API返回了无效的响应格式');
        }
        
        // 提取响应内容
        const responseContent = response.data.choices[0].message.content;
        
        // 检查是否返回思维链内容
        const hasReasoningContent = response.data.choices[0].message.reasoning_content ? true : false;
        console.log(`模型返回思维链: ${hasReasoningContent ? '是' : '否'}`);
        
        if (hasReasoningContent) {
            console.log('思维链内容预览:', response.data.choices[0].message.reasoning_content.substring(0, 100) + '...');
        }
        
        // 解析响应内容
        console.log('解析API响应内容...');
        console.log('响应内容预览:', responseContent.substring(0, 100) + '...');
        
        const issues = [];
        let totalIssues = 0;
        
        // 检查是否有问题发现
        if (responseContent.includes('问题描述') && responseContent.includes('原文引用') && responseContent.includes('违反条款')) {
            // 按问题分隔
            const problemSections = responseContent.split('---------------------------------------------');
            
            // 处理每个问题
            problemSections.forEach((section, index) => {
                if (!section.trim()) return;
                
                // 提取问题标题
                const titleMatch = section.match(/# 问题\d+：(.*)/);
                const title = titleMatch ? titleMatch[1].trim() : `问题 ${index + 1}`;
                
                // 提取问题描述
                const descriptionMatch = section.match(/\*\*问题描述：\*\*\s*([\s\S]*?)(?=\*\*原文引用：\*\*)/);
                const description = descriptionMatch ? descriptionMatch[1].trim() : '';
                
                // 提取原文引用
                const quoteMatch = section.match(/\*\*原文引用：\*\*\s*([\s\S]*?)(?=\*\*违反条款：\*\*)/);
                const quote = quoteMatch ? quoteMatch[1].trim().replace(/^"/, '').replace(/"$/, '') : '';
                
                // 提取违反条款
                const violationMatch = section.match(/\*\*违反条款：\*\*\s*([\s\S]*?)(?=\*\*修改建议：\*\*)/);
                const violation = violationMatch ? violationMatch[1].trim() : '';
                
                // 提取修改建议
                const suggestionMatch = section.match(/\*\*修改建议：\*\*\s*([\s\S]*?)(?=---|$)/);
                const suggestion = suggestionMatch ? suggestionMatch[1].trim() : '';
                
                // 添加到问题列表
                if (description || quote || violation || suggestion) {
                    issues.push({
                        id: index + 1,
                        title,
                        description,
                        quote,
                        violation,
                        suggestion
                    });
                    
                    totalIssues++;
                }
            });
        }
        
        // 如果没有找到问题，可能格式不是预期的
        if (totalIssues === 0 && responseContent.length > 100) {
            console.log('未检测到标准格式的问题，尝试简单解析...');
            
            // 创建一个通用问题
            issues.push({
                id: 1,
                title: '审查结果',
                description: '未检测到标准格式的问题，以下是原始审查结果:',
                quote: '',
                violation: '',
                suggestion: responseContent
            });
            
            totalIssues = 1;
        }
        
        console.log(`共解析出 ${totalIssues} 个问题`);
        
        // 构建最终结果
        const result = {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            totalIssues,
            issues,
            rawResponse: responseContent,
            reasoningContent: hasReasoningContent ? response.data.choices[0].message.reasoning_content : null
        };
        
        return result;
    } catch (error) {
        console.error('处理审查过程中出错:', error);
        throw error;
    }
}

// 获取模拟审查结果
function getMockReviewResults() {
    console.log('警告：尝试使用模拟数据！这不应该发生。');
    return {
        totalIssues: 1,
        issues: [
            {
                title: "模拟数据警告",
                description: "系统正在使用模拟数据，这表明API调用失败",
                quote: "这是一个明显的模拟数据响应，用于调试",
                suggestion: "请检查服务器日志以了解API调用失败的原因"
            }
        ]
    };
}

// 生成Word报告
function generateWordReport(fileName, reviewResults) {
    // 创建新文档
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // 标题
                new Paragraph({
                    text: "公平竞争审查报告",
                    heading: HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { after: 200 }
                }),
                
                // 基本信息
                new Paragraph({
                    text: "基本信息",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun("审查文件: "),
                        new TextRun({
                            text: fileName || "未命名文件",
                            bold: true
                        })
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun("审查时间: "),
                        new TextRun({
                            text: new Date().toLocaleString('zh-CN'),
                            bold: true
                        })
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun("问题数量: "),
                        new TextRun({
                            text: reviewResults.totalIssues.toString(),
                            bold: true
                        })
                    ],
                    spacing: { after: 200 }
                }),
                
                // 审查结果
                new Paragraph({
                    text: "审查结果",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                })
            ]
        }]
    });
    
    // 添加每个问题
    reviewResults.issues.forEach((issue, index) => {
        // 问题标题
        doc.addParagraph(
            new Paragraph({
                text: `问题 ${index + 1}: ${issue.title}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 }
            })
        );
        
        // 问题描述
        doc.addParagraph(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "问题描述: ",
                        bold: true
                    }),
                    new TextRun(issue.description)
                ],
                spacing: { after: 100 }
            })
        );
        
        // 原文引用
        doc.addParagraph(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "原文引用: ",
                        bold: true
                    })
                ],
                spacing: { after: 50 }
            })
        );
        
        doc.addParagraph(
            new Paragraph({
                text: issue.quote,
                indent: { left: 600 },
                spacing: { after: 100 }
            })
        );
        
        // 修改建议
        doc.addParagraph(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "修改建议: ",
                        bold: true
                    }),
                    new TextRun(issue.suggestion)
                ],
                spacing: { after: 200 }
            })
        );
    });
    
    // 添加结论
    doc.addParagraph(
        new Paragraph({
            text: "结论与建议",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
        })
    );
    
    doc.addParagraph(
        new Paragraph({
            text: `经审查，该文件共发现 ${reviewResults.totalIssues} 处可能存在的公平竞争问题。建议按照上述修改意见进行调整，确保文件符合公平竞争审查制度要求。`,
            spacing: { after: 100 }
        })
    );
    
    return doc;
}

// 创建错误对象
function createError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// 清理文件名
function sanitizeFileName(fileName) {
    // 移除不安全的字符
    return fileName.replace(/[\/\?<>\\:\*\|"]/g, '_');
}

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('应用错误:', err);
    
    // 处理multer错误
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小超过限制' });
        }
        return res.status(400).json({ error: `上传文件错误: ${err.message}` });
    }
    
    // 处理其他错误
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || '服务器内部错误';
    
    res.status(statusCode).json({ error: errorMessage });
});

// 处理404错误
app.use((req, res) => {
    res.status(404).json({ error: '请求的资源不存在' });
});

// 测试DeepSeek API连接
async function testDeepSeekAPI() {
    console.log('测试硅基流动DeepSeek API连接...');
    
    try {
        const apiKey = process.env.SILICONFLOW_API_KEY || 'sk-ndqddvkvqsfrvirhauqtrjejiwfawokxzakscpieqelbuhik';
        console.log(`使用的API密钥前缀: ${apiKey.substring(0, 5)}...`);
        
        // 设置模型列表优先尝试DeepSeek-R1
        const models = [
            "Pro/deepseek-ai/DeepSeek-R1",
            "Pro/Qwen/Qwen2.5-7B-Instruct",
            "Pro/Qwen/Qwen2.5-32B-Instruct",
            "Pro/Qwen/Qwen2.5-72B-Instruct"
        ];
        
        console.log('使用默认模型列表进行测试');
        let availableModel = null;
        
        // 依次测试模型
        for (const model of models) {
            console.log(`测试模型: ${model}...`);
            
            const requestBody = {
                model: model,
                messages: [
                    { role: "system", content: "你是一个帮助用户的助手。" },
                    { role: "user", content: "测试: 请回复'API连接正常'" }
                ],
                temperature: 0.5,
                max_tokens: 50,
                stream: false
            };
            
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            
            try {
                // 发送测试请求
                const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', requestBody, { headers });
                
                console.log(`模型 ${model} 测试成功! 状态码: ${response.status}`);
                
                // 检查是否支持思维链
                const hasReasoningContent = response.data.choices[0].message.reasoning_content ? true : false;
                console.log(`模型返回思维链: ${hasReasoningContent ? '是' : '否'}`);
                
                availableModel = model;
                break; // 找到一个工作的模型就停止测试
            } catch (modelError) {
                console.error(`模型 ${model} 测试失败: ${modelError.message}`);
                if (modelError.response) {
                    console.error(`错误代码: ${modelError.response.status}, 消息: ${JSON.stringify(modelError.response.data)}`);
                }
                // 继续尝试下一个模型
                continue;
            }
        }
        
        if (availableModel) {
            console.log(`API连接测试成功! 可用模型: ${availableModel}`);
            console.log(`已将 ${availableModel} 设置为全局可用模型`);
            // 这里可以设置全局变量或保存到环境中供后续使用
            global.availableModel = availableModel;
            return { success: true, model: availableModel };
        } else {
            console.error('所有模型测试均失败');
            return { success: false, error: '无可用模型' };
        }
        
    } catch (error) {
        console.error('API测试失败:', error.message);
        
        if (error.response) {
            console.error('测试错误详情:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        
        return { success: false, error: error.message };
    }
}

// 应用启动时测试API连接
app.listen(port, async () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    
    // 启动时测试API连接
    const apiTestResult = await testDeepSeekAPI();
    console.log(`API测试结果: ${apiTestResult.success ? '成功' : '失败'}`);
    
    if (apiTestResult.success) {
        console.log(`设置全局可用模型为: ${apiTestResult.model}`);
    } else {
        console.warn(`API连接测试失败: ${apiTestResult.error}`);
        console.warn('将使用默认模型进行后续请求');
    }
}); 