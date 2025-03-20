document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const submitButton = document.getElementById('submitButton');
    const loadingElement = document.getElementById('loading');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // 错误显示函数
    function displayError(message) {
        // 隐藏加载状态
        loadingElement.style.display = 'none';
        
        // 创建错误消息元素
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-icon">❌</div>
            <div class="error-text">
                <strong>审查过程中出错</strong><br>
                ${message}
            </div>
        `;
        
        // 将错误消息插入到loading元素后面
        loadingElement.parentNode.insertBefore(errorDiv, loadingElement.nextSibling);
        
        // 8秒后淡出并移除错误消息
        setTimeout(() => {
            errorDiv.style.opacity = '0';
            setTimeout(() => {
                errorDiv.remove();
            }, 500);
        }, 8000);
        
        // 重置进度条
        progressBar.style.width = '0%';
        progressText.textContent = '审查失败';
        
        // 重置按钮状态
        submitButton.disabled = false;
        fileInput.disabled = false;
    }

    function updateProgress(progress) {
        progressBar.style.width = `${progress}%`;
        if (progress === 100) {
            progressText.textContent = '审查完成！';
        } else {
            progressText.textContent = `正在处理... ${progress}%`;
        }
    }

    async function startReview(formData) {
        try {
            // 显示准备信息
            progressText.textContent = '准备开始审查...';
            progressBar.style.width = '0%';
            
            // 模拟进度，最多到95%
            let progress = 0;
            const progressInterval = setInterval(() => {
                if (progress < 95) {
                    progress += 0.5; // 减慢进度增加速度
                    updateProgress(progress);
                }
            }, 300); // 增加间隔时间
            
            // 设置超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
            
            // 提示用户文件处理可能需要一些时间
            progressText.textContent = '正在处理文件，可能需要2-3分钟...';
            
            try {
                const response = await fetch('/review', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // 检查响应状态
                if (!response.ok) {
                    // 尝试解析错误响应
                    let errorMessage;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || '服务器返回了错误状态码';
                        console.error('服务器错误详情:', errorData);
                    } catch (e) {
                        errorMessage = `服务器返回了错误状态码: ${response.status}`;
                        console.error('无法解析错误响应:', e);
                    }
                    throw new Error(errorMessage);
                }
                
                // 确保响应是JSON格式
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    console.error('非预期的响应类型:', contentType);
                    throw new Error('服务器返回了非JSON格式的响应');
                }
                
                // 解析响应
                const result = await response.json();
                
                // 检查响应格式
                if (!result || typeof result !== 'object') {
                    console.error('无效的响应格式:', result);
                    throw new Error('服务器返回了无效的响应格式');
                }
                
                // 检查是否有错误标志
                if (result.error === true) {
                    throw new Error(result.message || '服务器返回了错误响应');
                }
                
                // 停止进度模拟
                clearInterval(progressInterval);
                
                // 显示100%进度
                updateProgress(100);
                
                // 处理审查结果
                displayResults(result);
            } catch (error) {
                clearInterval(progressInterval);
                
                if (error.name === 'AbortError') {
                    throw new Error('请求超时，请稍后重试');
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('审查过程中出错:', error);
            displayError(error.message || '处理文件时发生错误');
        }
    }

    function displayResults(result) {
        // 隐藏加载状态
        loadingElement.style.display = 'none';
        
        // 创建结果容器
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'results-container';
        
        // 添加文件信息
        resultsDiv.innerHTML = `
            <div class="file-info">
                <h3>文件信息</h3>
                <p>文件名：${result.fileName}</p>
                <p>文件大小：${Math.round(result.fileSize / 1024)} KB</p>
                <p>发现问题数：${result.totalIssues}</p>
            </div>
        `;
        
        // 如果有问题，显示问题列表
        if (result.issues && result.issues.length > 0) {
            const issuesDiv = document.createElement('div');
            issuesDiv.className = 'issues-list';
            
            result.issues.forEach(issue => {
                const issueElement = document.createElement('div');
                issueElement.className = 'issue-item';
                issueElement.innerHTML = `
                    <h4>${issue.title}</h4>
                    ${issue.description ? `<div class="issue-description"><strong>问题描述：</strong>${issue.description}</div>` : ''}
                    ${issue.quote ? `<div class="issue-quote"><strong>原文引用：</strong>"${issue.quote}"</div>` : ''}
                    ${issue.violation ? `<div class="issue-violation"><strong>违反条款：</strong>${issue.violation}</div>` : ''}
                    ${issue.suggestion ? `<div class="issue-suggestion"><strong>修改建议：</strong>${issue.suggestion}</div>` : ''}
                `;
                issuesDiv.appendChild(issueElement);
            });
            
            resultsDiv.appendChild(issuesDiv);
        } else {
            // 如果没有问题，显示通过信息
            resultsDiv.innerHTML += `
                <div class="no-issues">
                    <h3>审查结果</h3>
                    <p>未发现竞争限制问题，文件符合公平竞争要求。</p>
                </div>
            `;
        }
        
        // 添加重新上传按钮
        const resetButton = document.createElement('button');
        resetButton.textContent = '重新上传';
        resetButton.className = 'reset-button';
        resetButton.onclick = function() {
            resultsDiv.remove();
            form.reset();
            submitButton.disabled = false;
            fileInput.disabled = false;
        };
        resultsDiv.appendChild(resetButton);
        
        // 将结果添加到页面
        document.body.appendChild(resultsDiv);
    }

    form.onsubmit = async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            alert('请选择要上传的文件');
            return;
        }
        
        // 检查文件类型
        if (!['application/pdf', 'text/plain'].includes(file.type)) {
            alert('只支持PDF和TXT文件');
            return;
        }
        
        // 检查文件大小（限制为50MB）
        if (file.size > 50 * 1024 * 1024) {
            alert('文件大小不能超过50MB');
            return;
        }
        
        // 禁用表单
        submitButton.disabled = true;
        fileInput.disabled = true;
        
        // 显示加载状态
        loadingElement.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '开始处理...';
        
        // 移除之前的结果（如果有）
        const previousResults = document.querySelector('.results-container');
        if (previousResults) {
            previousResults.remove();
        }
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);
        
        // 开始审查过程
        await startReview(formData);
    };
});
