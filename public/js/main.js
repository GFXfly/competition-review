document.addEventListener('DOMContentLoaded', function() {
    // 修正元素选择器，匹配HTML中的ID
    const uploadBtn = document.getElementById('upload-btn');
    const fileUpload = document.getElementById('file-upload');
    const reviewBtn = document.getElementById('review-btn');
    const uploadArea = document.getElementById('upload-area');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFile = document.getElementById('remove-file');
    const loadingElement = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.querySelector('.progress-message');
    const reviewResults = document.getElementById('review-results');
    const issuesContainer = document.getElementById('issues-container');
    const issueCount = document.getElementById('issue-count');
    const exportBtn = document.getElementById('export-btn');
    const newReviewBtn = document.getElementById('new-review-btn');
    
    // 添加一个全局函数，用于彻底清除处理中状态
    window.clearAllProcessingElements = function() {
        console.log("正在移除所有处理中状态...");
        
        // 移除所有处理中文本
        document.querySelectorAll('*').forEach(el => {
            if (el.textContent && el.textContent.includes('处理中')) {
                el.textContent = el.textContent.replace(/处理中\.+/g, '');
                el.classList.add('d-none');
                el.style.display = 'none';
            }
        });
        
        // 确保加载状态隐藏
        if (loadingElement) {
            loadingElement.classList.add('d-none');
            loadingElement.style.display = 'none';
            loadingElement.style.visibility = 'hidden';
            loadingElement.style.opacity = '0';
            loadingElement.style.position = 'absolute';
            loadingElement.style.zIndex = '-1000';
        }
        
        // 所有按钮恢复正常
        document.querySelectorAll('button').forEach(btn => {
            if (btn.textContent && btn.textContent.includes('处理中')) {
                btn.style.display = 'none';
            }
            if (btn.classList.contains('btn-apple-processing')) {
                btn.classList.remove('btn-apple-processing');
                btn.style.display = 'none';
            }
        });
    };
    
    // 页面加载时执行一次清理
    window.clearAllProcessingElements();
    
    // 当结果显示时，也执行清理
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'review-results' && 
                !mutation.target.classList.contains('d-none')) {
                window.clearAllProcessingElements();
            }
        });
    });
    
    observer.observe(reviewResults, { attributes: true });
    
    // 当前选择的文件
    let currentFile = null;
    // 当前结果中的问题
    let currentIssues = [];
    
    // 添加文件选择事件
    fileUpload.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            handleFileSelection(this.files[0]);
        }
    });
    
    // 注释掉原始的上传按钮事件，因为我们已经在HTML中使用onclick添加了showSecurityWarning函数
    // uploadBtn.addEventListener('click', function() {
    //     fileUpload.click();
    // });
    
    // 添加拖放功能
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('border-primary');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('border-primary');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('border-primary');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
    
    // 移除所选文件
    removeFile.addEventListener('click', function() {
        resetFileSelection();
    });
    
    // 开始审查
    reviewBtn.addEventListener('click', function() {
        if (currentFile) {
            // 涉密文件确认已经在选择文件前完成，此处直接开始审查
            startReview();
        }
    });
    
    // 重新审查
    newReviewBtn.addEventListener('click', function() {
        resetFileSelection();
        reviewResults.classList.add('d-none');
        uploadArea.classList.remove('d-none');
    });
    
    // 导出报告
    exportBtn.addEventListener('click', async function() {
        try {
            // 禁用导出按钮并显示加载状态
            this.disabled = true;
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>导出中...';
            
            // 获取当前文件名
            const currentFileName = currentFile ? currentFile.name : '未命名文件';
            
            // 调试日志
            console.log('====== 导出调试信息 ======');
            console.log('文件名:', currentFileName);
            console.log('问题数量:', currentIssues ? currentIssues.length : 0);
            console.log('问题数据结构:', JSON.stringify(currentIssues, null, 2));
            
            // 如果issues为空数组，创建一个虚拟的问题
            const issuesToSend = currentIssues && currentIssues.length > 0 ? currentIssues : [{
                id: 1,
                title: '审查结果',
                description: '未发现公平竞争问题',
                quote: '',
                violation: '',
                suggestion: '文件符合公平竞争要求，无需修改。'
            }];
            
            console.log('发送的请求数据:', JSON.stringify({
                fileName: currentFileName,
                issues: issuesToSend
            }, null, 2));
            
            // 发送导出请求
            const response = await fetch('/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: currentFileName,
                    issues: issuesToSend
                })
            });
            
            console.log('服务器响应状态:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('服务器错误响应:', errorText);
                throw new Error(`导出失败: ${response.status} - ${errorText}`);
            }
            
            // 获取Blob数据
            const blob = await response.blob();
            console.log('收到Blob响应，MIME类型:', blob.type, '大小:', blob.size);
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentFileName.replace(/\.[^/.]+$/, '')}_审查报告.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // 恢复按钮状态
            this.disabled = false;
            this.innerHTML = originalText;
            
        } catch (error) {
            console.error('导出报告时出错:', error);
            alert(`导出报告失败: ${error.message}`);
            
            // 恢复按钮状态
            this.disabled = false;
            this.innerHTML = originalText;
        }
    });
    
    // 处理文件选择
    function handleFileSelection(file) {
        // 检查文件类型
        const allowedTypes = ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['txt', 'docx'];
        
        // 同时检查MIME类型和文件扩展名
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
            alert('只支持 DOCX 和 TXT 文件');
            return;
        }
        
        // 检查文件大小（限制为30MB）
        if (file.size > 30 * 1024 * 1024) {
            alert('文件大小不能超过30MB\n\n建议：对于较大的文件，请拆分成多个小文件分别上传审查。');
            return;
        }
        
        // 保存当前文件
        currentFile = file;
        
        // 显示文件信息
        uploadArea.classList.add('d-none');
        fileInfo.classList.remove('d-none');
        fileName.textContent = file.name;
        fileSize.textContent = `文件大小: ${formatFileSize(file.size)}`;
        
        // 启用审查按钮
        reviewBtn.disabled = false;
    }
    
    // 重置文件选择
    function resetFileSelection() {
        currentFile = null;
        currentIssues = [];
        fileUpload.value = '';
        fileInfo.classList.add('d-none');
        uploadArea.classList.remove('d-none');
        reviewBtn.disabled = true;
    }
    
    // 格式化文件大小
    function formatFileSize(bytes) {
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 开始审查过程
    async function startReview() {
        try {
            // 禁用界面元素
            reviewBtn.disabled = true;
            reviewBtn.textContent = "处理中...";
            reviewBtn.classList.add('btn-apple-processing');
            fileInfo.classList.add('d-none');
            
            // 显示加载状态
            loadingElement.classList.remove('d-none');
            loadingElement.style.display = 'block';
            loadingElement.style.visibility = 'visible';
            loadingElement.style.opacity = '1';
            loadingElement.style.position = 'relative';
            loadingElement.style.zIndex = '1';
            progressBar.style.width = '0%';
            progressText.textContent = '准备开始审查...';
            
            // 改进的进度逻辑：文件越大，估计时间越长
            let progress = 0;
            // 根据文件大小动态调整总时间
            const fileSize = currentFile ? currentFile.size : 0;
            const fileSizeInMB = fileSize / (1024 * 1024);
            
            // 对大文件增加更多的预估时间
            let baseDuration = 15000; // 基础时间15秒
            let additionalTimePerMB = 1000; // 默认每MB增加1秒
            
            // 根据文件大小调整参数
            if (fileSizeInMB > 10) {
                // 大于10MB的文件
                additionalTimePerMB = 1500; // 每MB增加1.5秒
                baseDuration = 20000; // 基础时间增加到20秒
            }
            if (fileSizeInMB > 20) {
                // 大于20MB的文件
                additionalTimePerMB = 2000; // 每MB增加2秒
                baseDuration = 30000; // 基础时间增加到30秒
            }
            
            const totalTime = baseDuration + (fileSizeInMB * additionalTimePerMB);
            console.log(`文件大小: ${fileSizeInMB.toFixed(2)}MB, 预计处理时间: ${(totalTime/1000).toFixed(1)}秒`);
            
            let startTime = Date.now();
            let lastUpdate = startTime;
            let errorRetryCount = 0; // 记录错误重试次数
            
            const progressTimer = setInterval(() => {
                const now = Date.now();
                const elapsedTime = now - startTime;
                // 降低最大进度到80%，为大文件留出更多余量
                const timeFraction = Math.min(elapsedTime / totalTime, 0.80); 
                
                // 修改进度曲线，前期更加平缓
                // 使用更高次幂，使开始阶段更慢
                progress = 100 * (Math.pow(timeFraction, 2.2) * 0.80);
                
                // 确保一开始特别慢
                if (progress < 10) {
                    progress = progress * 0.3; // 开始时只有30%速度
                }
                
                // 更新视觉效果
                progressBar.style.width = `${progress}%`;
                
                // 每500ms更新一次文本，避免闪烁且减少更新频率
                if (now - lastUpdate > 500) {
                    // 进度文本要向下取整，避免出现小数
                    const displayProgress = Math.floor(progress);
                    progressText.textContent = `正在处理... ${displayProgress}%`;
                    lastUpdate = now;
                }
                
                // 超过预期时间后，非常缓慢前进
                if (elapsedTime > totalTime && progress < 95) {
                    // 减慢速度，每100ms仅增加0.01%
                    progress += 0.01;
                    progressBar.style.width = `${progress}%`;
                }
                
                // 检查是否长时间停留在一个区间
                if (elapsedTime > totalTime * 2 && progress < 90) {
                    progress = 91; // 直接跳到91%
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `正在处理... ${Math.floor(progress)}%`;
                }
                
                // 如果处理时间过长（超过5分钟），添加提示
                if (elapsedTime > 300000 && elapsedTime < 300500) { // 仅在5分钟时提示一次
                    progressText.textContent = `处理大文件中，请耐心等待... ${Math.floor(progress)}%`;
                }
            }, 100);
            
            // 创建FormData对象
            const formData = new FormData();
            formData.append('file', currentFile);
            
            try {
                // 增加超时时间 - 15分钟，足够处理大文档
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 900000);
                
                let response;
                
                try {
                    response = await fetch('/review', {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                    });
                } catch (fetchError) {
                    // 网络错误或中断，尝试重试一次
                    if (errorRetryCount < 1) {
                        errorRetryCount++;
                        console.log("首次请求失败，正在尝试重试...");
                        progressText.textContent = `正在重试请求... ${Math.floor(progress)}%`;
                        
                        // 等待2秒后重试
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        response = await fetch('/review', {
                            method: 'POST',
                            body: formData,
                            signal: controller.signal
                        });
                    } else {
                        throw fetchError; // 重试失败，抛出原始错误
                    }
                }
                
                clearTimeout(timeoutId);
                
                // 检查响应状态
                if (!response.ok) {
                    // 针对大文件特别处理413和500错误
                    if (response.status === 413) {
                        throw new Error('文件过大，超出服务器接收限制。请将文件拆分为多个小文件（建议小于10MB）后重新上传。');
                    } else if (response.status === 500) {
                        if (fileSizeInMB > 15) {
                            throw new Error('服务器处理大文件时出错。建议：\n1. 将文件拆分为多个小文件（10MB以下）\n2. 简化文件格式（如从PDF转为纯文本）\n3. 移除文件中的图片和复杂格式');
                        } else {
                            throw new Error('服务器处理文件时出错，可能是文件格式复杂或包含不支持的内容。请简化文件内容后重试。');
                        }
                    } else {
                        throw new Error(`服务器返回了错误状态码: ${response.status}`);
                    }
                }
                
                // 尝试解析响应
                let result;
                try {
                    result = await response.json();
                } catch (jsonError) {
                    // JSON解析错误，可能是响应格式问题
                    throw new Error('服务器返回了无效的数据格式。可能是文件过大导致处理超时，请尝试使用更小的文件。');
                }
                
                // 显示100%完成
                progress = 100;
                progressBar.style.width = '100%';
                progressText.textContent = `处理完成 100%`;
                
                // 延迟一下再隐藏进度条，让用户看到100%的状态
                setTimeout(() => {
                    // 停止进度模拟
                    clearInterval(progressTimer);
                    
                    // 保存当前问题
                    currentIssues = result.issues || [];
                    
                    // 完全隐藏加载状态
                    loadingElement.classList.add('d-none');
                    
                    // 确保处理中按钮不会显示
                    reviewBtn.textContent = "开始审查";
                    reviewBtn.classList.remove('btn-apple-processing');
                    
                    // 更新问题数量
                    issueCount.textContent = result.totalIssues || 0;
                    
                    // 处理问题列表
                    displayIssues(currentIssues);
                    
                    // 显示结果
                    reviewResults.classList.remove('d-none');
                }, 800);
                
            } catch (error) {
                clearInterval(progressTimer);
                
                // 显示错误信息，美化格式
                console.error('审查过程中出错:', error);
                loadingElement.classList.add('d-none');
                
                // 增加对各种错误的友好提示
                let errorMessage = error.message;
                if (errorMessage.includes('500')) {
                    errorMessage = `服务器处理文件时出错。文件大小: ${fileSizeInMB.toFixed(2)}MB\n\n建议：\n1. 将文件拆分为多个小文件（建议10MB以下）\n2. 简化文件格式（如从PDF转为纯文本）\n3. 移除文件中的图片和复杂格式`;
                } else if (errorMessage.includes('aborted') || errorMessage.includes('timeout') || errorMessage.includes('请求超时')) {
                    errorMessage = `处理超时。文件可能过大(${fileSizeInMB.toFixed(2)}MB)或格式复杂。\n\n建议：\n1. 拆分为小文件后重试\n2. 使用纯文本格式代替复杂格式`;
                } else if (errorMessage.includes('network') || errorMessage.includes('连接') || errorMessage.includes('Network Error')) {
                    errorMessage = '网络连接异常。请检查您的网络连接并重试。';
                } else if (errorMessage.includes('API密钥无效') || errorMessage.includes('401')) {
                    errorMessage = 'API密钥无效或已过期，请联系系统管理员更新API密钥。';
                } else if (errorMessage.includes('请求次数超限') || errorMessage.includes('429')) {
                    errorMessage = 'API请求次数超限，请稍后再试或联系管理员。';
                }
                
                // 使用更友好的错误提示
                alert(`审查过程中出错:\n${errorMessage}\n\n如果问题持续存在，请联系系统管理员。`);
                
                // 恢复界面状态
                reviewBtn.disabled = false;
                reviewBtn.textContent = "开始审查";
                reviewBtn.classList.remove('btn-apple-processing');
                fileInfo.classList.remove('d-none');
            }
        } catch (error) {
            console.error('启动审查过程中出错:', error);
            alert(`启动审查过程中出错: ${error.message}`);
        }
    }
    
    // 显示问题列表
    function displayIssues(issues) {
        // 清空容器
        issuesContainer.innerHTML = '';
        
        if (issues.length === 0) {
            // 没有问题
            issuesContainer.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    未发现竞争限制问题，文件符合公平竞争要求。
                    <p class="small text-muted mt-2">（审查依据：《公平竞争审查条例实施办法》国家市场监督管理总局2025年2月28日公布）</p>
                </div>
            `;
            return;
        }
        
        // 添加审查标准信息
        const standardInfo = document.createElement('div');
        standardInfo.className = 'mb-4 text-muted';
        standardInfo.innerHTML = `<p class="small">审查依据：《公平竞争审查条例实施办法》（国家市场监督管理总局2025年2月28日公布）</p>`;
        issuesContainer.appendChild(standardInfo);
        
        // 添加每个问题
        issues.forEach((issue, index) => {
            const issueElement = document.createElement('div');
            issueElement.className = 'issue-card-apple';
            
            issueElement.innerHTML = `
                <div class="issue-header-apple">
                    <h3 class="h5 mb-0 title-apple">问题 ${index + 1}: ${issue.title || '未命名问题'}</h3>
                </div>
                <div class="issue-body-apple">
                    ${issue.description ? `<div class="mb-3"><strong>问题描述:</strong> ${issue.description}</div>` : ''}
                    ${issue.quote ? `<div class="mb-3"><strong>原文引用:</strong><div class="quote-apple">${issue.quote}</div></div>` : ''}
                    ${issue.violation ? `<div class="mb-3"><strong>违反条款:</strong> ${issue.violation}</div>` : ''}
                    ${issue.suggestion ? `<div class="mb-3"><strong>修改建议:</strong><div class="suggestion-apple mt-2">${issue.suggestion}</div></div>` : ''}
                </div>
            `;
            
            issuesContainer.appendChild(issueElement);
        });
    }
});

