/**
 * 公平竞争审查在线工具
 * 主要JavaScript功能实现
 */

// 全局变量
let currentFile = null;
let reviewResults = null;

// DOM元素
const uploadArea = document.getElementById('upload-area');
const fileUpload = document.getElementById('file-upload');
const uploadBtn = document.getElementById('upload-btn');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFileBtn = document.getElementById('remove-file');
const reviewBtn = document.getElementById('review-btn');
const loadingEl = document.getElementById('loading');
const reviewResultsEl = document.getElementById('review-results');
const issueCount = document.getElementById('issue-count');
const issuesContainer = document.getElementById('issues-container');
const exportBtn = document.getElementById('export-btn');
const newReviewBtn = document.getElementById('new-review-btn');
const issueTemplate = document.getElementById('issue-template');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
});

// 初始化事件监听器
function initEventListeners() {
    // 文件上传相关事件
    uploadBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    
    // 文件操作相关事件
    removeFileBtn.addEventListener('click', removeFile);
    reviewBtn.addEventListener('click', startReview);
    exportBtn.addEventListener('click', exportReport);
    newReviewBtn.addEventListener('click', resetReview);
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// 处理拖拽文件
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
}

// 处理文件
function processFile(file) {
    // 检查文件类型
    const validTypes = ['.docx', '.pdf', '.txt'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExt)) {
        alert('不支持的文件类型！请上传 .docx, .pdf 或 .txt 格式的文件。');
        return;
    }
    
    // 保存当前文件
    currentFile = file;
    
    // 更新UI
    fileName.textContent = file.name;
    fileSize.textContent = `文件大小: ${formatFileSize(file.size)}`;
    fileInfo.classList.remove('d-none');
    uploadArea.classList.add('d-none');
    reviewBtn.disabled = false; // 启用开始审查按钮
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 移除文件
function removeFile() {
    currentFile = null;
    fileUpload.value = '';
    fileInfo.classList.add('d-none');
    uploadArea.classList.remove('d-none');
    reviewBtn.disabled = true;
}

// 开始审查
async function startReview() {
    if (!currentFile) return;
    
    // 显示加载状态
    reviewBtn.disabled = true;
    reviewBtn.textContent = "审查中...";
    reviewBtn.classList.add('btn-apple-processing');
    loadingEl.classList.remove('d-none');
    fileInfo.classList.add('d-none');
    
    // 初始化进度条
    const progressBar = document.getElementById('progress-bar');
    const progressMessage = document.querySelector('.progress-message');
    progressBar.style.width = '0%';
    progressMessage.textContent = '准备开始审查...';
    
    // 启动模拟进度
    let progress = 0;
    const progressInterval = 50; // 更新频率 (毫秒)
    const estimatedTime = 30000; // 估计完成时间 (毫秒)
    const progressStep = 100 / (estimatedTime / progressInterval);
    
    const progressTimer = setInterval(() => {
        if (progress >= 98) {
            clearInterval(progressTimer);
            return;
        }
        
        // 进度增量策略 - 开始快，中间慢，接近结束再加速
        let increment;
        if (progress < 30) {
            increment = progressStep * 1.5; // 前30%进度快一些
        } else if (progress < 70) {
            increment = progressStep * 0.7; // 中间进度慢一些
        } else {
            increment = progressStep * 1.2; // 接近结束再快一些
        }
        
        progress += increment;
        progress = Math.min(progress, 98); // 确保不超过98%
        
        progressBar.style.width = `${progress}%`;
        
        // 更新进度消息
        if (progress < 20) {
            progressMessage.textContent = '正在分析文件结构...';
        } else if (progress < 40) {
            progressMessage.textContent = '提取文件关键内容...';
        } else if (progress < 60) {
            progressMessage.textContent = '对照审查标准进行评估...';
        } else if (progress < 80) {
            progressMessage.textContent = '正在查找潜在的竞争问题...';
        } else {
            progressMessage.textContent = '生成审查报告...';
        }
    }, progressInterval);
    
    try {
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', currentFile);
        
        // 调用后端API
        const response = await fetch('/api/review', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '审查请求失败');
        }
        
        const results = await response.json();
        console.log('收到审查结果:', results);
        
        // 验证API结果格式
        if (!results.issues || !Array.isArray(results.issues)) {
            throw new Error('服务器返回的数据格式不正确');
        }
        
        // 完成进度条
        clearInterval(progressTimer);
        progressBar.style.width = '100%';
        progressMessage.textContent = '审查完成！';
        
        // 短暂延迟后显示结果，确保用户看到进度条完成
        setTimeout(() => {
            reviewResults = results;
            displayReviewResults(reviewResults);
        }, 800);
        
    } catch (error) {
        console.error('审查过程中出错:', error);
        
        // 停止进度条
        clearInterval(progressTimer);
        progressBar.style.width = '0%';
        progressMessage.textContent = '审查失败: ' + error.message;
        
        // 显示错误提示
        alert('审查过程中出错: ' + error.message);
        
        // 重置UI
        reviewBtn.disabled = false;
        reviewBtn.textContent = "开始审查";
        reviewBtn.classList.remove('btn-apple-processing');
        loadingEl.classList.add('d-none');
        fileInfo.classList.remove('d-none');
    }
}

// 读取文件内容
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        
        reader.onerror = (e) => {
            reject(new Error('文件读取失败'));
        };
        
        // 根据文件类型选择不同的读取方式
        if (file.type === 'application/pdf') {
            // 对于PDF文件，这里需要使用PDF.js等库进行处理
            // 简化起见，这里仅读取为二进制数据
            reader.readAsArrayBuffer(file);
        } else {
            // 对于文本文件和Word文档
            // 注意：对于Word文档，实际应用中需要使用专门的库解析
            reader.readAsText(file);
        }
    });
}

// 执行审查 (调用DeepSeek API)
async function performReview(fileContent) {
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', currentFile);
    
    // 显示正在处理的消息
    console.log('正在发送文件到服务器进行审查...');
    
    // 调用后端API
    try {
        const response = await fetch('/api/review', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '审查请求失败');
        }
        
        const results = await response.json();
        console.log('收到审查结果:', results);
        
        // 验证API结果格式
        if (!results.issues || !Array.isArray(results.issues)) {
            throw new Error('服务器返回的数据格式不正确');
        }
        
        return results;
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

// 显示审查结果
function displayReviewResults(results) {
    // 隐藏加载状态
    loadingEl.classList.add('d-none');
    
    // 更新问题计数
    issueCount.textContent = results.totalIssues;
    
    // 清空问题容器
    issuesContainer.innerHTML = '';
    
    // 添加文件基本信息
    const fileInfoElement = document.createElement('div');
    fileInfoElement.classList.add('file-info-section', 'mb-4');
    fileInfoElement.innerHTML = `
        <h4 class="section-title">文件基本信息</h4>
        <div class="info-content">
            <p><strong>文件类型：</strong>${results.fileType || '未识别'}</p>
            <p><strong>政策领域：</strong>${results.policyArea || '未识别'}</p>
            <p><strong>审查对象：</strong>${results.reviewTarget || '未明确'}</p>
        </div>
    `;
    issuesContainer.appendChild(fileInfoElement);
    
    // 添加问题项
    results.issues.forEach(issue => {
        const issueElement = createIssueElement(issue);
        issuesContainer.appendChild(issueElement);
    });
    
    // 添加总结性意见
    if (results.summary) {
        const summaryElement = document.createElement('div');
        summaryElement.classList.add('summary-section', 'mt-4');
        summaryElement.innerHTML = `
            <h4 class="section-title">总结性意见</h4>
            <div class="summary-content">
                <p>${results.summary}</p>
            </div>
        `;
        issuesContainer.appendChild(summaryElement);
    }
    
    // 添加风险提示
    if (results.riskTips) {
        const riskElement = document.createElement('div');
        riskElement.classList.add('risk-section', 'mt-4');
        riskElement.innerHTML = `
            <h4 class="section-title">风险提示</h4>
            <div class="risk-content">
                <p>${results.riskTips}</p>
            </div>
        `;
        issuesContainer.appendChild(riskElement);
    }
    
    // 显示结果区域
    reviewResultsEl.classList.remove('d-none');
    reviewResultsEl.classList.add('fade-in');
}

// 创建问题元素
function createIssueElement(issue) {
    const clone = document.importNode(issueTemplate.content, true);
    
    // 更新问题标题
    clone.querySelector('.issue-title').textContent = issue.title;
    
    // 更新问题描述
    const descriptionHtml = `
        <div class="issue-description">
            <p><strong>问题类别：</strong>${issue.category || '未分类'}</p>
            <p><strong>违反法规：</strong>${issue.violation || '未明确'}</p>
            <p><strong>可能后果：</strong>${issue.consequence || '未说明'}</p>
            <p><strong>问题描述：</strong>${issue.description}</p>
        </div>
    `;
    clone.querySelector('.issue-description').innerHTML = descriptionHtml;
    
    // 更新原文引用
    clone.querySelector('.issue-quote').textContent = issue.quote;
    
    // 更新修改建议
    const suggestionHtml = `
        <div class="issue-suggestion">
            <p><strong>修改建议：</strong>${issue.suggestion}</p>
            <p><strong>修改理由：</strong>${issue.reason || '未说明'}</p>
            <p><strong>法律依据：</strong>${issue.legalBasis || '未明确'}</p>
        </div>
    `;
    clone.querySelector('.issue-suggestion').innerHTML = suggestionHtml;
    
    return clone;
}

// 导出报告
function exportReport() {
    if (!reviewResults || !currentFile) return;
    
    // 从文件名中提取标题部分（去掉扩展名）
    const fileTitle = currentFile.name.substring(0, currentFile.name.lastIndexOf('.'));
    // 创建报告标题：关于XX的修改建议
    const reportTitle = `关于《${fileTitle}》的修改建议`;
    
    // 创建报告内容
    let reportContent = '';
    
    // 如果没有问题，则显示无问题
    if (reviewResults.totalIssues === 0) {
        reportContent = `经审查，未发现《${fileTitle}》中存在限制公平竞争的内容。`;
    } else {
        // 对每个问题，添加标题、描述、引用和建议
        reviewResults.issues.forEach((issue, index) => {
            reportContent += `问题${index + 1}：${issue.title}\n\n`;
            reportContent += `${issue.description}\n\n`;
            reportContent += `原文引用：${issue.quote}\n\n`;
            reportContent += `修改建议：${issue.suggestion}\n\n`;
            
            // 除了最后一个问题，其他问题后面都加分隔线
            if (index < reviewResults.issues.length - 1) {
                reportContent += `------------------------------------------------\n\n`;
            }
        });
    }
    
    // 显示加载状态
    const loadingDialog = document.createElement('div');
    loadingDialog.classList.add('export-options-dialog');
    loadingDialog.innerHTML = `
        <div class="export-options-content card-apple p-4 text-center">
            <div class="mb-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
            </div>
            <h5 class="title-apple">正在生成公文格式的Word文档...</h5>
            <p class="subtitle-apple">请稍候，这可能需要几秒钟</p>
        </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .export-options-dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }
        .export-options-content {
            width: 320px;
            border-radius: var(--apple-radius);
            background: white;
            box-shadow: var(--apple-shadow);
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loadingDialog);
    
    // 异步生成文档
    setTimeout(() => {
        try {
            // 生成Word文档
            generateDocxReport(reportTitle, reportContent, fileTitle)
                .then(blob => {
                    // 下载文件
                    downloadFile(blob, `${reportTitle}.docx`);
                    // 移除加载对话框
                    document.body.removeChild(loadingDialog);
                })
                .catch(error => {
                    console.error('生成文档出错:', error);
                    alert('生成文档出错: ' + error.message);
                    document.body.removeChild(loadingDialog);
                });
        } catch (error) {
            console.error('导出文档出错:', error);
            alert('导出过程中出错: ' + error.message);
            document.body.removeChild(loadingDialog);
        }
    }, 100);
}

// 下载文件辅助函数
function downloadFile(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// 生成Word文档报告（标准公文格式）
async function generateDocxReport(title, content, fileTitle) {
    try {
        // 动态加载docx库
        const { Document, Paragraph, TextRun, AlignmentType, 
               BorderStyle, Packer } = await import('https://cdn.jsdelivr.net/npm/docx@8.2.4/+esm');
        
        // 创建文档实例，添加必要的属性
        const doc = new Document({
            creator: "公平竞争审查工具",
            title: title,
            description: "公平竞争审查报告",
            sections: []
        });
        
        // 准备段落数组
        const paragraphs = [];
        
        // 添加标题
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: title,
                        font: "方正小标宋",
                        size: 44, // 小二
                        bold: true,
                    }),
                ],
            })
        );
        
        // 添加空行
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "",
                    }),
                ],
            })
        );
        
        // 将content内容解析为段落
        const lines = content.split('\n');
        let currentParagraph = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 处理分隔线
            if (line.trim() === '------------------------------------------------') {
                if (currentParagraph.trim()) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: currentParagraph,
                                    font: "仿宋",
                                    size: 32, // 小四号
                                }),
                            ],
                        })
                    );
                    currentParagraph = '';
                }
                
                // 添加分隔线
                paragraphs.push(
                    new Paragraph({
                        border: {
                            bottom: {
                                color: "999999",
                                space: 1,
                                style: BorderStyle.SINGLE,
                                size: 6,
                            },
                        },
                    })
                );
                
                i++; // 跳过空行
                continue;
            }
            
            // 处理问题标题
            if (line.match(/^问题\d+：/)) {
                if (currentParagraph.trim()) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: currentParagraph,
                                    font: "仿宋",
                                    size: 32, // 小四号
                                }),
                            ],
                        })
                    );
                    currentParagraph = '';
                }
                
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                font: "楷体",
                                size: 32, // 小四号
                                bold: true,
                            }),
                        ],
                    })
                );
                continue;
            }
            
            // 处理原文引用
            if (line.startsWith('原文引用：')) {
                if (currentParagraph.trim()) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: currentParagraph,
                                    font: "仿宋",
                                    size: 32, // 小四号
                                }),
                            ],
                        })
                    );
                    currentParagraph = '';
                }
                
                // 引用文字单独样式
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '原文引用：',
                                font: "仿宋",
                                size: 32, // 小四号
                                bold: true,
                            }),
                        ],
                    })
                );
                
                const quoteText = line.substring('原文引用：'.length);
                
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: quoteText,
                                font: "仿宋",
                                size: 32, // 小四号
                                italics: true,
                            }),
                        ],
                        indent: {
                            left: 480, // 左侧缩进
                        },
                        border: {
                            left: {
                                color: "3366FF",
                                space: 12,
                                style: BorderStyle.SINGLE,
                                size: 12,
                            },
                        },
                        shading: {
                            fill: "F8F9FA",
                        },
                    })
                );
                continue;
            }
            
            // 处理修改建议
            if (line.startsWith('修改建议：')) {
                if (currentParagraph.trim()) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: currentParagraph,
                                    font: "仿宋",
                                    size: 32, // 小四号
                                }),
                            ],
                        })
                    );
                    currentParagraph = '';
                }
                
                // 建议文字单独样式
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '修改建议：',
                                font: "仿宋",
                                size: 32, // 小四号
                                bold: true,
                            }),
                        ],
                    })
                );
                
                const suggestionText = line.substring('修改建议：'.length);
                
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: suggestionText,
                                font: "仿宋",
                                size: 32, // 小四号
                                color: "2A7A48",
                            }),
                        ],
                        indent: {
                            left: 480, // 左侧缩进
                        },
                        border: {
                            left: {
                                color: "35C759",
                                space: 12,
                                style: BorderStyle.SINGLE,
                                size: 12,
                            },
                        },
                        shading: {
                            fill: "F4FBF6",
                        },
                    })
                );
                continue;
            }
            
            // 处理普通段落
            if (line.trim()) {
                if (currentParagraph) {
                    currentParagraph += '\n';
                }
                currentParagraph += line;
            } else if (currentParagraph) {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: currentParagraph,
                                font: "仿宋",
                                size: 32, // 小四号
                            }),
                        ],
                    })
                );
                currentParagraph = '';
            }
        }
        
        // 添加最后一个段落（如果有）
        if (currentParagraph.trim()) {
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: currentParagraph,
                            font: "仿宋",
                            size: 32, // 小四号
                        }),
                    ],
                })
            );
        }
        
        // 添加页脚段落
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: "杭州市临安区市场监督管理局",
                        font: "仿宋",
                        size: 24, // 小五号
                    }),
                ],
            })
        );
        
        // 添加一个包含所有段落的section
        doc.addSection({
            properties: {},
            children: paragraphs
        });
        
        // 生成Word文档
        return await Packer.toBlob(doc);
    } catch (error) {
        console.error("文档生成错误:", error);
        throw error;
    }
}

// 重置审查
function resetReview() {
    // 重置状态
    reviewResultsEl.classList.add('d-none');
    uploadArea.classList.remove('d-none');
    
    // 清除文件
    currentFile = null;
    fileUpload.value = '';
    reviewBtn.disabled = true;
    
    // 清除结果
    reviewResults = null;
} 