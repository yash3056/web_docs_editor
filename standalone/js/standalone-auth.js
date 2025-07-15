// Standalone authentication system using localStorage
class StandaloneAuth {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
    }

    loadUsers() {
        const users = localStorage.getItem('standalone_users');
        return users ? JSON.parse(users) : [];
    }

    saveUsers() {
        localStorage.setItem('standalone_users', JSON.stringify(this.users));
    }

    loadCurrentUser() {
        const user = localStorage.getItem('standalone_current_user');
        return user ? JSON.parse(user) : null;
    }

    saveCurrentUser(user) {
        localStorage.setItem('standalone_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    clearCurrentUser() {
        localStorage.removeItem('standalone_current_user');
        this.currentUser = null;
    }

    register(email, username, password) {
        // Check if user already exists
        const existingUser = this.users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            email: email,
            username: username,
            password: password, // In a real app, this would be hashed
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers();
        
        return {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username
        };
    }

    login(email, password) {
        const user = this.users.find(u => u.email === email && u.password === password);
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const userInfo = {
            id: user.id,
            email: user.email,
            username: user.username
        };

        this.saveCurrentUser(userInfo);
        return userInfo;
    }

    logout() {
        this.clearCurrentUser();
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Create global auth instance
const standaloneAuth = new StandaloneAuth();

// Create a demo user if none exists
if (standaloneAuth.users.length === 0) {
    try {
        standaloneAuth.register('demo@example.com', 'demo', 'demo123');
        console.log('Demo user created: demo@example.com / demo123');
    } catch (error) {
        console.log('Demo user already exists');
    }
}