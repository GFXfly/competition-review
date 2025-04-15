const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, ShadingType } = require('docx');
const path = require('path');
const fs = require('fs').promises;
const timeout = require('connect-timeout');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// 设置静态文件目录
app.use(express.static('public'));

// 添加JSON解析中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 设置全局超时
app.use(timeout('300s'));

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 限制50MB
    }
});

// 提取文本内容
async function extractTextFromFile(file) {
    try {
        if (file.mimetype === 'application/pdf') {
            const data = await pdf(file.buffer);
            return data.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // 使用mammoth处理DOCX文件
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            return result.value;
        } else if (file.mimetype === 'text/plain') {
            return file.buffer.toString('utf8');
        } else {
            throw new Error('不支持的文件类型');
        }
    } catch (error) {
        console.error('提取文本时出错:', error);
        throw error;
    }
}

// 调用DeepSeek API进行审查
async function performReview(req) {
    // 添加这一行标识当前代码版本
    console.log('【版本标识】使用硅基流动DeepSeek-R1接口 v2.3.3 - 超强型错误处理');
    
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
        
        // 设置API密钥
        let apiKey;
        if (process.env.SILICONFLOW_API_KEY) {
            apiKey = process.env.SILICONFLOW_API_KEY;
            console.log('使用环境变量中的API密钥');
        } else {
            // 固定使用原始API密钥，不进行轮换
            apiKey = 'sk-ndqddvkvqsfrvirhauqtrjejiwfawokxzakscpieqelbuhik';
            console.log('使用默认API密钥');
        }
        
        // 记录API密钥前缀以便调试（不要记录完整的密钥）
        console.log(`使用API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
        
        // 修改API URL为硅基流动地址
        const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        console.log(`使用API URL: ${apiUrl}`);
        
        // 更新系统提示词，基于《公平竞争审查条例实施办法》
        const systemPrompt = `你是一个专业的公平竞争审查专家，负责审查文件中可能存在的限制竞争问题，并给出专业修改建议。

你需要严格基于《公平竞争审查条例实施办法》（国家市场监督管理总局2025年2月28日公布，自2025年4月20日起施行）进行审查。

审查应当重点关注以下四类标准：

1. 限制市场准入和退出的问题：
   - 违法设置市场准入审批程序
   - 违法设置或授予政府特许经营权
   - 限定经营、购买或使用特定经营者提供的商品
   - 设置不合理或歧视性的准入、退出条件

2. 限制商品、要素自由流动的问题：
   - 限制外地或进口商品、要素进入本地市场，或阻碍本地商品输出
   - 排斥、限制外地经营者在本地投资或设立分支机构
   - 排斥、限制外地经营者参加本地政府采购、招标投标
   - 对外地或进口商品设置歧视性收费、价格或补贴
   - 对外地经营者设置歧视性资质标准或监管要求

3. 影响生产经营成本的问题：
   - 无法律依据给予特定经营者税收优惠
   - 无法律依据给予特定经营者选择性财政奖励或补贴
   - 无法律依据给予特定经营者要素获取、行政事业性收费等优惠

4. 影响生产经营行为的问题：
   - 强制或变相强制经营者实施垄断行为
   - 超越法定权限为特定经营者提供优惠价格
   - 违法干预实行市场调节价的商品价格

请严格按照以下格式组织你的回答：
# 问题1：[问题标题]
**问题描述：**  
[详细问题描述]

**原文引用：**  
"[从原文中精确引用问题段落]"

**违反条款：**  
违反《公平竞争审查条例实施办法》第[N]条"[条款具体内容]"。

**修改建议：**  
[具体修改建议]

---------------------------------------------

按此格式提供所有发现的问题。如果没有发现问题，请说明文档符合公平竞争要求。

在分析中要特别注意《公平竞争审查条例实施办法》第二十五条规定的例外情形：
1. 维护国家安全和发展利益的
2. 促进科学技术进步、增强国家自主创新能力的
3. 实现节约能源、保护环境、救灾救助等社会公共利益的
4. 法律、行政法规规定或经国务院批准的其他情形

以上例外情形仍需满足"没有对公平竞争影响更小的替代方案，并能够确定合理的实施期限或者终止条件"的要求。

非常重要：在违反条款部分，必须只引用《公平竞争审查条例实施办法》，不要引用《公平竞争审查制度实施细则》或《反垄断法》。`;

        const userPrompt = `请帮我审查以下政府文件是否存在限制竞争问题，找出所有疑似问题并给出修改建议：

${fileContent}`;

        console.log('构建API请求...');
        
        // 尝试不同的模型
        const models = [
            "Pro/deepseek-ai/DeepSeek-R1",
            "Pro/Qwen/Qwen2.5-7B-Instruct",
            "Pro/01-ai/Yi-VL-34B",
            "Pro/meta-llama/Meta-Llama-3-8B-Instruct",
            "Pro/meta-llama/Meta-Llama-3-70B-Instruct"
        ];
        
        console.log('可用模型列表:', models.join(', '));
        
        // 强制使用DeepSeek-R1模型，不进行轮换
        const modelToUse = "Pro/deepseek-ai/DeepSeek-R1";
        console.log(`强制使用模型: ${modelToUse}`);
        
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
                timeout: 300000, // 增加到5分钟
                maxContentLength: 50 * 1024 * 1024, // 增加到50MB
                maxBodyLength: 50 * 1024 * 1024, // 增加到50MB
                validateStatus: function (status) {
                    // 允许处理所有状态码
                    return true;
                },
                // 添加响应转换器确保总是返回JSON
                transformResponse: [function(data, headers) {
                    // 检查内容类型
                    const contentType = headers['content-type'] || '';
                    
                    // 记录原始响应
                    console.log('API响应内容类型:', contentType);
                    console.log('API响应长度:', data ? data.length : 0);
                    
                    // 记录更多API响应信息用于调试
                    console.log('API响应头部信息:', JSON.stringify(headers, null, 2));
                    console.log('API响应内容预览:', data ? data.substring(0, 500) : 'No data');
                    
                    if (contentType.includes('application/json')) {
                        // 如果是JSON，尝试解析
                        try {
                            return JSON.parse(data);
                        } catch (e) {
                            console.error('JSON解析失败:', e);
                            console.error('响应内容预览:', data?.substring(0, 200));
                            // 返回格式化的错误对象
                            return {
                                error: true, 
                                message: '服务器返回了无效的JSON格式',
                                raw: data?.substring(0, 1000) || null
                            };
                        }
                    } else {
                        // 如果不是JSON，返回格式化的错误对象
                        console.error('非JSON响应:', contentType);
                        console.error('响应内容预览:', data?.substring(0, 200));
                        return {
                            error: true,
                            message: `服务器返回了非JSON格式: ${contentType}`,
                            raw: data?.substring(0, 1000) || null
                        };
                    }
                }]
            });
            const endTime = Date.now();
            
            console.log(`API响应时间: ${endTime - startTime}ms`);
            console.log('API响应状态:', response.status);
            
            // 检查状态码，如果不是2xx，抛出异常
            if (response.status < 200 || response.status >= 300) {
                let errorMessage = `API返回了错误状态码: ${response.status}`;
                
                // 格式化错误信息
                if (response.data) {
                    if (response.data.error) {
                        errorMessage = response.data.message || response.data.error;
                    } else if (typeof response.data === 'object') {
                        errorMessage += ` - ${JSON.stringify(response.data).substring(0, 200)}`;
                    }
                }
                
                throw new Error(errorMessage);
            }
            
            // 检查响应数据中是否包含error标志
            if (response.data && response.data.error === true) {
                console.error('API响应包含错误标志:', response.data);
                throw new Error(response.data.message || '服务器返回了错误响应');
            }
            
            // 确保响应包含所需字段
            if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
                console.error('无效的API响应格式:', response.data);
                throw new Error('API返回了无效的响应格式');
            }
        } catch (error) {
            // 处理请求错误
            console.error('请求API时发生错误:', error.message);
            
            // 添加更详细的网络错误信息
            if (error.code) {
                console.error('网络错误代码:', error.code);
            }
            
            // 记录更多错误详情
            console.error('错误详情:', error);
            if (error.response) {
                console.error('错误响应状态:', error.response.status);
                console.error('错误响应头:', JSON.stringify(error.response.headers, null, 2));
                console.error('错误响应内容:', error.response.data);
            }
            
            // 构建更详细的错误信息
            let errorMessage = '调用API服务失败';
            if (error.message.includes('timeout')) {
                errorMessage = '请求超时，API服务响应时间过长';
            } else if (error.message.includes('Network Error')) {
                errorMessage = '网络连接错误，无法连接到API服务';
            } else if (error.response && error.response.status === 401) {
                errorMessage = 'API密钥无效或已过期，请联系管理员更新API密钥';
            } else if (error.response && error.response.status === 429) {
                errorMessage = 'API请求次数超限，请稍后再试';
            } else if (error.response && error.response.data && error.response.data.error) {
                errorMessage = `API服务错误: ${error.response.data.error}`;
            }
            
            // 将错误直接抛出，不使用本地问题分析
            throw new Error(`${errorMessage}。详细信息: ${error.message}`);
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
        // 确保返回标准化的JSON错误格式
        throw {
            statusCode: 500,
            message: error.message || '服务器内部错误',
            error: true
        };
    }
}

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '2.3.3' });
});

// 处理文件上传和审查
app.post('/review', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('未上传文件');
        }
        
        // 检查文件类型
        if (!['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(req.file.mimetype)) {
            throw new Error('不支持的文件类型，仅支持PDF、DOCX和TXT文件');
        }
        
        const result = await performReview(req);
        res.json(result);
    } catch (error) {
        console.error('处理请求时出错:', error);
        
        // 确保返回标准化的错误响应
        const statusCode = error.statusCode || 500;
        const errorResponse = {
            error: true,
            message: error.message || '服务器内部错误',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
        
        res.status(statusCode).json(errorResponse);
    }
});

// 修改导出路由
app.post('/export', async (req, res) => {
    try {
        console.log('收到导出请求:', {
            fileName: req.body.fileName,
            issuesCount: req.body.issues?.length || 0
        });

        const { fileName, issues } = req.body;
        
        if (!fileName) {
            console.error('导出请求缺少文件名');
            return res.status(400).json({ error: '缺少文件名' });
        }

        if (!Array.isArray(issues)) {
            console.error('导出请求中的issues不是数组:', issues);
            return res.status(400).json({ error: '问题列表格式不正确' });
        }

        console.log('处理的issues数据样例:', JSON.stringify(issues.slice(0, 1), null, 2));

        try {
            // 创建Word文档 - 使用更接近网页显示的简洁风格
            const doc = new Document({
                styles: {
                    paragraphStyles: [
                        {
                            id: "Title",
                            name: "Title",
                            basedOn: "Normal",
                            next: "Normal",
                            run: {
                                size: 40,  // 更大的标题
                                font: "黑体",
                                bold: true,
                            },
                            paragraph: {
                                alignment: AlignmentType.CENTER,
                                spacing: { line: 380, before: 240, after: 240 },
                            },
                        },
                        {
                            id: "Heading1",
                            name: "Heading 1",
                            basedOn: "Normal",
                            next: "Normal",
                            run: {
                                size: 40,  // 更大的标题
                                font: "黑体",
                                bold: true,
                            },
                            paragraph: {
                                alignment: AlignmentType.CENTER,
                                spacing: { line: 380, before: 240, after: 240 },
                            },
                        },
                        {
                            id: "Heading3",
                            name: "Heading 3",
                            basedOn: "Normal",
                            next: "Normal",
                            run: {
                                size: 32,  // 问题标题
                                font: "黑体",
                                bold: true,
                                color: "333333",
                            },
                            paragraph: {
                                spacing: { line: 380, before: 240, after: 120 },
                                indent: {
                                    firstLine: 0  // 问题标题不需要缩进
                                }
                            },
                        },
                        {
                            id: "Normal",
                            name: "Normal",
                            run: {
                                size: 24,  // 正文字体
                                font: "仿宋",
                            },
                            paragraph: {
                                spacing: { line: 380, before: 0, after: 0 },
                                indent: {
                                    firstLine: 560  // 全局添加首行缩进2字符
                                }
                            },
                        },
                    ],
                },
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1134,    // 约40mm
                                right: 1134,  // 约40mm
                                bottom: 1134, // 约40mm
                                left: 1134,   // 约40mm
                            }
                        }
                    },
                    children: [
                        new Paragraph({
                            text: `《${fileName.replace(/\.[^/.]+$/, '')}》公平竞争审查报告`,
                            style: "Heading1",
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ 
                                    text: `发现 `,
                                    size: 32,
                                    font: "仿宋"
                                }),
                                new TextRun({ 
                                    text: issues.length.toString(),
                                    size: 32,
                                    font: "仿宋",
                                    color: "FF0000",
                                    bold: true
                                }),
                                new TextRun({ 
                                    text: ` 个问题`,
                                    size: 32,
                                    font: "仿宋"
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: {
                                after: 480,
                                line: 380
                            }
                        }),
                        new Paragraph({
                            text: `审查依据：《公平竞争审查条例实施办法》（国家市场监督管理总局2025年2月28日公布）`,
                            size: 28,
                            font: "仿宋",
                            color: "333333",
                            spacing: {
                                after: 560,
                                line: 380
                            },
                            indent: {
                                firstLine: 560  // 添加首行缩进2字符
                            }
                        }),
                    ].concat(
                        // 使用更简洁的问题展示格式
                        issues.flatMap((issue, index) => {
                            console.log(`处理问题 ${index + 1}`);
                            const result = [];
                            
                            // 创建问题卡片风格的边框段落 - 浅黄色背景卡片，类似图片中的样式
                            result.push(
                                new Paragraph({
                                    text: `问题 ${index + 1}：${issue.title || '未命名问题'}`,
                                    style: "Heading3",
                                    shading: {
                                        type: ShadingType.CLEAR,
                                        color: "FFF8DC", // 浅黄色背景
                                        fill: "FFF8DC"
                                    },
                                    border: {
                                        top: {
                                            color: "F0F0F0",
                                            space: 1,
                                            value: "single",
                                            size: 6
                                        },
                                        bottom: {
                                            color: "F0F0F0",
                                            space: 1,
                                            value: "single",
                                            size: 6
                                        },
                                        left: {
                                            color: "F0F0F0",
                                            space: 1,
                                            value: "single",
                                            size: 6
                                        },
                                        right: {
                                            color: "F0F0F0",
                                            space: 1,
                                            value: "single",
                                            size: 6
                                        }
                                    },
                                    spacing: {
                                        before: 360,
                                        after: 240,
                                    },
                                    indent: {
                                        left: 0,
                                        firstLine: 0  // 标题不缩进
                                    }
                                })
                            );
                            
                            // 问题描述 - 白色背景
                            if (issue.description) {
                                result.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ 
                                                text: "问题描述：",
                                                bold: true,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                            new TextRun({ 
                                                text: issue.description,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                        ],
                                        spacing: {
                                            before: 120,
                                            after: 120,
                                            line: 380
                                        },
                                        indent: {
                                            firstLine: 560  // 添加首行缩进2字符
                                        }
                                    })
                                );
                            }
                            
                            // 原文引用 - 浅蓝色左边框，类似图片中的引用样式
                            if (issue.quote) {
                                result.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ 
                                                text: issue.quote,
                                                italics: true,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                        ],
                                        spacing: {
                                            before: 120,
                                            after: 120,
                                            line: 380
                                        },
                                        shading: {
                                            type: ShadingType.CLEAR,
                                            color: "F0F8FF",
                                            fill: "F0F8FF"
                                        },
                                        border: {
                                            left: {
                                                color: "4169E1",
                                                space: 1,
                                                value: "single",
                                                size: 16
                                            }
                                        },
                                        indent: {
                                            left: 280,
                                            right: 280,
                                            firstLine: 0  // 引用不需要首行缩进
                                        }
                                    })
                                );
                            }
                            
                            // 违反条款 - 普通段落
                            if (issue.violation) {
                                result.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ 
                                                text: "违反条款：", 
                                                bold: true,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                            new TextRun({ 
                                                text: issue.violation,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                        ],
                                        spacing: {
                                            before: 120,
                                            after: 120,
                                            line: 380
                                        },
                                        indent: {
                                            firstLine: 560  // 添加首行缩进2字符
                                        }
                                    })
                                );
                            }
                            
                            // 修改建议 - 浅绿色背景，类似图片中的建议样式
                            if (issue.suggestion) {
                                result.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ 
                                                text: issue.suggestion,
                                                size: 24,
                                                font: "仿宋"
                                            }),
                                        ],
                                        spacing: {
                                            before: 120,
                                            after: 240,
                                            line: 380
                                        },
                                        shading: {
                                            type: ShadingType.CLEAR,
                                            color: "F0FFF0",
                                            fill: "F0FFF0"
                                        },
                                        indent: {
                                            left: 280,
                                            right: 280,
                                            firstLine: 560  // 添加首行缩进2字符
                                        }
                                    })
                                );
                            }
                            
                            return result;
                        })
                    ).concat([
                        new Paragraph({
                            text: "本报告由AI自动生成，仅供参考。内容如有疑问，请以相关法律法规为准。",
                            alignment: AlignmentType.CENTER,
                            spacing: {
                                before: 560,
                                after: 240,
                                line: 380
                            },
                            run: {
                                size: 24,
                                font: "仿宋",
                                color: "666666"
                            }
                        }),
                        new Paragraph({
                            text: `生成时间：${new Date().toLocaleString()}`,
                            alignment: AlignmentType.CENTER,
                            spacing: {
                                after: 240,
                                line: 380
                            },
                            run: {
                                size: 24,
                                font: "仿宋",
                                color: "666666"
                            }
                        }),
                    ]),
                }],
            });

            console.log('开始生成Word文档...');
            
            // 生成Word文档
            const buffer = await Packer.toBuffer(doc);
            console.log('Word文档生成成功，大小:', buffer.length, '字节');
            
            // 处理文件名
            const safeFileName = encodeURIComponent(fileName.replace(/\.[^/.]+$/, '') + '_审查报告.docx');
            
            // 发送Word文档 - 修复响应头
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"; filename*=UTF-8''${safeFileName}`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // 发送缓冲区
            res.end(buffer);
            console.log('文档发送成功');
        } catch (docError) {
            console.error('生成Word文档时出错:', docError);
            console.error('文档错误堆栈:', docError.stack);
            throw new Error(`Word文档生成失败: ${docError.message}`);
        }
    } catch (error) {
        console.error('生成Word报告时出错:', error);
        console.error('错误堆栈:', error.stack);
        res.status(500).json({ 
            error: '生成Word报告失败',
            details: error.message
        });
    }
});

// 启动服务器
if (require.main === module) {
  app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
  });
}

// 为Vercel部署导出应用
module.exports = app;
