/** Profile domain texts */
export default {
  title: 'Profile',
  subtitle: 'Manage your account information and sign-in methods.',
  // Role labels
  role: {
    admin: 'Admin',
    user: 'User'
  },
  // Account status
  status: {
    enabled: 'Enabled',
    disabled: 'Disabled'
  },
  // Overview stats
  stats: {
    balance: 'Balance',
    concurrency: 'Concurrency limit',
    registeredAt: 'Registered'
  },
  // Profile & avatar form
  form: {
    title: 'Profile & avatar',
    subtitle: 'Keep your public information up to date with a consistent avatar and name.',
    avatarLabel: 'Profile avatar',
    avatarHint: 'Static images are auto-compressed to under 20KB; GIFs must be kept under 20KB yourself.',
    uploadImage: 'Upload image',
    uploadFailed: 'Upload failed',
    imageTooLarge: 'Image is too large, please choose a smaller one',
    username: 'Username',
    usernamePlaceholder: 'Username (1–50 characters)',
    updateProfile: 'Update profile'
  },
  // Operation result toasts
  toast: {
    updateSuccess: 'Profile updated',
    updateFailed: 'Failed to update profile',
    avatarSuccess: 'Avatar updated',
    avatarRemoved: 'Avatar removed',
    avatarFailed: 'Failed to update avatar',
    unbindSuccess: 'Unbound',
    bindFailed: 'Failed to start binding',
    unbindFailed: 'Failed to unbind'
  },
  // Account bindings
  binding: {
    title: 'Account bindings',
    subtitle: 'Review your current bindings and link more third-party sign-in methods to this account.',
    bound: 'Bound',
    unbound: 'Not bound',
    bind: 'Bind',
    unbind: 'Unbind',
    // Provider display names (brand names left untranslated)
    providers: {
      email: 'Email',
      wechat: 'WeChat',
      dingtalk: 'DingTalk'
    },
    // Provider descriptions
    desc: {
      email: '{email} · Primary email is managed in the profile form',
      linuxdo: 'Sign in quickly with your LinuxDo account',
      wechat: 'Scan with WeChat to sign in quickly',
      dingtalk: 'Link enterprise DingTalk for team management',
      oidc: 'Connect via standard OIDC single sign-on'
    }
  }
}
