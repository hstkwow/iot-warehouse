<template>
  <div class="login-container">
    <!-- 左侧装饰区域 -->
    <div class="login-left">
      <div class="logo">
        <div class="logo-icon">
          <i class="el-icon-s-grid"></i>
        </div>
        <span class="logo-text">智能仓储系统</span>
      </div>
      
      <!-- 装饰图形 -->
      <div class="decorations">
        <div class="circle-outline"></div>
        <div class="square-rotated"></div>
        <div class="circle-small"></div>
        <div class="dot dot-1"></div>
        <div class="dot dot-2"></div>
        <div class="dot dot-3"></div>
        <div class="squares-group">
          <div class="square square-1"></div>
          <div class="square square-2"></div>
          <div class="square square-3"></div>
        </div>
      </div>
      
      <!-- 主图标 -->
      <div class="main-illustration">
        <i class="el-icon-s-home"></i>
      </div>
      
      <!-- 底部文字 -->
      <div class="left-text">
        <h1>智慧应急仓储管理</h1>
        <p>实时监测 · 高效管理 · 智能预警</p>
      </div>
    </div>
    
    <!-- 右侧登录表单 -->
    <div class="login-right">
      <div class="login-form-wrapper">
        <div class="form-header">
          <h2>欢迎回来</h2>
          <p>请登录您的账号继续使用</p>
        </div>
        
        <el-form 
          :model="form" 
          :rules="rules" 
          ref="loginForm" 
          class="login-form"
          @keyup.enter.native="handleLogin">
          
          <el-form-item prop="username">
            <el-input 
              v-model="form.username" 
              placeholder="请输入账号"
              prefix-icon="el-icon-user"
              size="large">
            </el-input>
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input 
              v-model="form.password" 
              type="password" 
              placeholder="请输入密码" 
              prefix-icon="el-icon-lock"
              size="large"
              show-password>
            </el-input>
          </el-form-item>
          
          <div class="form-options">
            <el-checkbox v-model="form.remember">记住我</el-checkbox>
            <el-link type="primary" :underline="false">忘记密码?</el-link>
          </div>
          
          <el-form-item>
            <el-button 
              type="primary" 
              class="login-btn" 
              :loading="loading"
              @click="handleLogin">
              {{ loading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>
        
        <div class="form-footer">
          <span>还没有账号？</span>
          <el-link type="primary" :underline="false">立即注册</el-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { login } from '@/api/sysUser'

export default {
  name: 'LoginView',
  data() {
    return {
      loading: false,
      form: {
        username: '',
        password: '',
        remember: true
      },
      rules: {
        username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
      }
    }
  },
  methods: {
    handleLogin() {
      this.$refs.loginForm.validate(async valid => {
        if (!valid) return
        this.loading = true
        
        try {
          const res = await login({
            username: this.form.username,
            password: this.form.password
          })

          if (res.code === 1 || res.code === 200) {
            // Store token and user info
            const token = res.data.token
            const user = res.data.user
            
            // Log for debugging
            console.log('Login success user:', user);
            
            localStorage.setItem('token', token)
            localStorage.setItem('user', JSON.stringify(user))
            localStorage.setItem('isLogin', '1')

            this.$message.success('登录成功，欢迎回来！')
            this.$router.push('/dashboard')
          } else {
             // Request failed but returned valid response (handled by interceptor usually, but safe to add)
             this.$message.error(res.msg || '登录失败，请检查账号密码')
          }
        } catch (error) {
          console.error('Login error:', error)
          // Error is usually handled by request interceptor
        } finally {
          this.loading = false
        }
      })
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  background: var(--bg-white);
}

/* ========================================
   左侧装饰区域
   ======================================== */
.login-left {
  position: relative;
  width: 55%;
  background: linear-gradient(135deg, var(--primary-light-6) 0%, var(--primary-light-8) 100%);
  padding: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  z-index: 10;
}

.logo-icon {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light-1) 100%);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(93, 135, 255, 0.3);
}

.logo-icon i {
  font-size: 22px;
  color: #fff;
}

.logo-text {
  margin-left: 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 装饰元素 */
.decorations {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.circle-outline {
  position: absolute;
  top: 15%;
  left: 20%;
  width: 60px;
  height: 60px;
  border: 3px solid var(--primary-light-4);
  border-radius: 50%;
  animation: float 6s ease-in-out infinite;
}

.square-rotated {
  position: absolute;
  top: 45%;
  left: 12%;
  width: 50px;
  height: 50px;
  background: var(--primary-light-5);
  border-radius: var(--radius-md);
  transform: rotate(45deg);
  animation: float 8s ease-in-out infinite reverse;
}

.circle-small {
  position: absolute;
  bottom: 30%;
  left: 28%;
  width: 20px;
  height: 20px;
  background: var(--primary-light-4);
  border-radius: 50%;
  animation: pulse 4s ease-in-out infinite;
}

.dot {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--primary-light-3);
  border-radius: 50%;
}

.dot-1 {
  top: 20%;
  right: 30%;
  animation: pulse 3s ease-in-out infinite;
}

.dot-2 {
  top: 35%;
  right: 15%;
  animation: pulse 4s ease-in-out infinite 1s;
}

.dot-3 {
  bottom: 40%;
  right: 25%;
  animation: pulse 3.5s ease-in-out infinite 0.5s;
}

.squares-group {
  position: absolute;
  bottom: 80px;
  left: 40px;
  width: 120px;
  height: 120px;
}

.squares-group .square {
  position: absolute;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(93, 135, 255, 0.1);
}

.square-1 {
  top: 10px;
  left: 20px;
  width: 45px;
  height: 45px;
  background: rgba(93, 135, 255, 0.25);
  animation: float 5s ease-in-out infinite;
}

.square-2 {
  top: 30px;
  left: 45px;
  width: 60px;
  height: 60px;
  background: rgba(93, 135, 255, 0.15);
  animation: float 6s ease-in-out infinite 0.5s;
}

.square-3 {
  top: 55px;
  left: 75px;
  width: 30px;
  height: 30px;
  background: rgba(93, 135, 255, 0.35);
  animation: float 4s ease-in-out infinite 1s;
}

/* 主图标 */
.main-illustration {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: float 6s ease-in-out infinite;
}

.main-illustration i {
  font-size: 120px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light-2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 8px 24px rgba(93, 135, 255, 0.3));
}

/* 底部文字 */
.left-text {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 10;
}

.left-text h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.left-text p {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0;
}

/* 动画 */
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ========================================
   右侧登录表单
   ======================================== */
.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--bg-white);
}

.login-form-wrapper {
  width: 100%;
  max-width: 400px;
  animation: slideIn 0.5s var(--ease-smooth);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.form-header {
  margin-bottom: 40px;
}

.form-header h2 {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.form-header p {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0;
}

/* 表单样式 */
.login-form .el-form-item {
  margin-bottom: 24px;
}

.login-form .el-input__inner {
  height: 48px;
  font-size: 15px;
  border-radius: var(--radius-md);
  padding-left: 44px;
}

.login-form .el-input__prefix {
  left: 12px;
}

.login-form .el-input__icon {
  font-size: 18px;
  color: var(--text-placeholder);
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.form-options .el-checkbox__label {
  color: var(--text-secondary);
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 4px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light-1) 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(93, 135, 255, 0.35);
  transition: all var(--transition-fast) var(--ease-smooth);
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(93, 135, 255, 0.45);
}

.form-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--text-secondary);
}

.form-footer .el-link {
  font-size: 14px;
  margin-left: 4px;
}

/* ========================================
   响应式设计
   ======================================== */
@media (max-width: 1024px) {
  .login-left {
    width: 45%;
  }
  
  .main-illustration i {
    font-size: 100px;
  }
  
  .left-text h1 {
    font-size: 24px;
  }
}

@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
  }
  
  .login-left {
    width: 100%;
    height: 280px;
    padding: 20px;
  }
  
  .main-illustration {
    display: none;
  }
  
  .decorations {
    opacity: 0.5;
  }
  
  .left-text {
    bottom: 30px;
  }
  
  .left-text h1 {
    font-size: 22px;
  }
  
  .login-right {
    padding: 30px 20px;
  }
  
  .login-form-wrapper {
    max-width: 100%;
  }
  
  .form-header h2 {
    font-size: 26px;
  }
}
</style>
