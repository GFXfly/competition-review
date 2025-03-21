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
    
    // 当前选择的文件
    let currentFile = null;
    // 当前结果中的问题
    let currentIssues = [];
    
    // 添加上传按钮点击事件
    uploadBtn.addEventListener('click', function() {
        fileUpload.click();
    });
    
    // 添加文件选择事件
    fileUpload.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            handleFileSelection(this.files[0]);
        }
    });
    
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
        const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            alert('只支持 PDF、DOCX 和 TXT 文件');
            return;
        }
        
        // 检查文件大小（限制为50MB）
        if (file.size > 50 * 1024 * 1024) {
            alert('文件大小不能超过50MB');
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
            progressBar.style.width = '0%';
            progressText.textContent = '准备开始审查...';
            
            // 模拟进度，最多到95%
            let progress = 0;
            const progressMax = 95;
            const progressStep = 0.3;
            let increment = progressStep;
            
            const progressTimer = setInterval(() => {
                // 根据进度动态调整增量
                if (progress > 30) increment = progressStep * 0.8; // 30%后慢一些
                if (progress > 60) increment = progressStep * 0.5; // 60%后更慢
                if (progress > 85) increment = progressStep * 0.3; // 85%后非常慢
                if (progress > 90) increment = progressStep * 0.1; // 90%后几乎不动
                
                // 快结束时增加速度，模拟请求即将完成
                if (progress >= 90 && progress < 92) increment = progressStep * 1.2; // 接近结束再快一些
                
                if (progress < progressMax) {
                    progress += increment;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `正在处理... ${Math.round(progress)}%`;
                }
            }, 300);
            
            // 创建FormData对象
            const formData = new FormData();
            formData.append('file', currentFile);
            
            try {
                // 设置超时 - 5分钟
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000);
                
                const response = await fetch('/review', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // 检查响应状态
                if (!response.ok) {
                    throw new Error(`服务器返回了错误状态码: ${response.status}`);
                }
                
                // 解析响应
                const result = await response.json();
                
                // 停止进度模拟
                clearInterval(progressTimer);
                progressBar.style.width = '100%';
                progressText.textContent = '审查完成!';
                
                // 保存当前问题
                currentIssues = result.issues || [];
                
                // 短暂延迟后显示结果
                setTimeout(() => {
                    // 隐藏加载状态
                    loadingElement.classList.add('d-none');
                    
                    // 更新问题数量
                    issueCount.textContent = result.totalIssues || 0;
                    
                    // 处理问题列表
                    displayIssues(currentIssues);
                    
                    // 显示结果
                    reviewResults.classList.remove('d-none');
                }, 500);
                
            } catch (error) {
                clearInterval(progressTimer);
                
                // 显示错误信息
                console.error('审查过程中出错:', error);
                loadingElement.classList.add('d-none');
                alert(`审查过程中出错: ${error.message}`);
                
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
                </div>
            `;
            return;
        }
        
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
                    ${issue.quote ? `<div class="quote-apple mb-3">${issue.quote}</div>` : ''}
                    ${issue.violation ? `<div class="mb-3"><strong>违反条款:</strong> ${issue.violation}</div>` : ''}
                    ${issue.suggestion ? `<div class="suggestion-apple">${issue.suggestion}</div>` : ''}
                </div>
            `;
            
            issuesContainer.appendChild(issueElement);
        });
    }
});
