# Quest Action Parameters Specification

This document defines the standard parameter structure for each Quest action type in the VRControl system.

## Overview

Action parameters are stored as JSON objects in the `params` field of each action. When executing actions, these parameters are automatically loaded from the database and passed to the ADB manager for execution.

## Action Types and Parameters

### 1. Wake Up Device (`wake_up`)

Wakes up a device from sleep mode by sending a power button keycode.

**Parameters:**
- None required (uses empty object `{}`)

**Optional Parameters:**
- `timeout` (integer): Maximum time to wait for device to wake up in milliseconds
  - Default: System default
  - Example: `5000` (5 seconds)

**Example:**
```json
{
  "timeout": 5000
}
```

---

### 2. Sleep Device (`sleep`)

Puts a device into sleep mode.

**Parameters:**
- None required (uses empty object `{}`)

**Optional Parameters:**
- `force` (boolean): Whether to force sleep even if device is in use
  - Default: `false`
  - Example: `true`

**Example:**
```json
{
  "force": false
}
```

---

### 3. Launch App (`launch_app`)

Launches an Android application on the device.

**Required Parameters:**
- `package` (string): The package name of the application
  - Example: `"com.example.app"`
  - Example: `"com.Awespire.OrientalBeauty"`

**Optional Parameters:**
- `activity` (string): The specific activity to launch within the app
  - Default: Main/launcher activity
  - Example: `".MainActivity"`
  - Example: `"com.unity3d.player.UnityPlayerGameActivity"`
- `extras` (object): Additional intent extras to pass to the application
  - Default: `{}` (no extras)
  - Example: `{"key1": "value1", "key2": 123}`

**Example:**
```json
{
  "package": "com.example.app",
  "activity": ".MainActivity",
  "extras": {
    "debug_mode": true,
    "user_id": "12345"
  }
}
```

**Minimal Example:**
```json
{
  "package": "com.example.app"
}
```

---

### 4. Stop App (`stop_app`)

Stops a running Android application.

**Required Parameters:**
- `package` (string): The package name of the application to stop
  - Example: `"com.example.app"`

**Optional Parameters:**
- `method` (string): Method to use for stopping the app
  - Default: `"force-stop"`
  - Options: `"force-stop"`, `"kill"`
  - Example: `"force-stop"`

**Example:**
```json
{
  "package": "com.example.app",
  "method": "force-stop"
}
```

**Minimal Example:**
```json
{
  "package": "com.example.app"
}
```

---

### 5. Restart App (`restart_app`)

Stops and then relaunches an Android application.

**Required Parameters:**
- `package` (string): The package name of the application to restart
  - Example: `"com.example.app"`

**Optional Parameters:**
- `activity` (string): The specific activity to launch when restarting
  - Default: Main/launcher activity
  - Example: `".MainActivity"`
- `delay` (integer): Time to wait between stop and start in milliseconds
  - Default: `1000` (1 second)
  - Example: `2000` (2 seconds)

**Example:**
```json
{
  "package": "com.example.app",
  "activity": ".MainActivity",
  "delay": 2000
}
```

**Minimal Example:**
```json
{
  "package": "com.example.app"
}
```

---

### 6. Keep Awake (`keep_awake`)

Keeps the device awake for a specified duration.

**Optional Parameters:**
- `duration_seconds` (integer): How long to keep the device awake in seconds
  - Default: `3600` (1 hour)
  - Example: `7200` (2 hours)

**Example:**
```json
{
  "duration_seconds": 3600
}
```

---

### 7. Send Key (`send_key`)

Sends a keycode event to the device (simulates hardware button press).

**Required Parameters:**
- `keycode` (integer): The Android keycode to send
  - Example: `26` (KEYCODE_POWER)
  - Example: `4` (KEYCODE_BACK)
  - Example: `3` (KEYCODE_HOME)

**Optional Parameters:**
- `repeat` (integer): Number of times to send the keycode
  - Default: `1`
  - Example: `3` (send keycode 3 times)

**Example:**
```json
{
  "keycode": 26,
  "repeat": 1
}
```

**Common Keycodes:**
- `3`: KEYCODE_HOME
- `4`: KEYCODE_BACK
- `24`: KEYCODE_VOLUME_UP
- `25`: KEYCODE_VOLUME_DOWN
- `26`: KEYCODE_POWER
- `82`: KEYCODE_MENU
- `187`: KEYCODE_APP_SWITCH

---

### 8. Install APK (`install_apk`)

Installs an APK file on the device.

**Required Parameters:**
- `apk_path` (string): Full path to the APK file on the server
  - Example: `"/path/to/app.apk"`
  - Example: `"C:\\apks\\myapp.apk"`

**Optional Parameters:**
- `replace` (boolean): Whether to replace existing installation
  - Default: `true`
  - Example: `false`
- `grant_permissions` (boolean): Whether to grant all runtime permissions automatically
  - Default: `true`
  - Example: `false`

**Example:**
```json
{
  "apk_path": "/path/to/app.apk",
  "replace": true,
  "grant_permissions": true
}
```

**Minimal Example:**
```json
{
  "apk_path": "/path/to/app.apk"
}
```

---

## Parameter Naming Conventions

### Important Notes

1. **Use `package` not `package_name`**: For all app-related actions (`launch_app`, `stop_app`, `restart_app`), the parameter name must be `package`, not `package_name`.

2. **Case Sensitivity**: All parameter names are case-sensitive and should be in lowercase with underscores (snake_case).

3. **Type Safety**: 
   - Strings must be quoted: `"com.example.app"`
   - Numbers must not be quoted: `26`, `3600`
   - Booleans must be lowercase: `true`, `false`

4. **Required vs Optional**: Required parameters must always be provided. If missing, the action will fail with an error message indicating which parameter is required.

## Error Messages

When required parameters are missing, the system will return specific error messages:

- `"package name required"` - Missing `package` parameter for app actions
- `"keycode required"` - Missing `keycode` parameter for send_key action
- `"apk_path required"` - Missing `apk_path` parameter for install_apk action

## Validation

### Frontend Validation

The frontend form provides:
- Parameter templates for each action type
- JSON syntax validation before submission
- Schema-based parameter validation (checks for required fields)

### Backend Validation

The backend checks:
- Required parameters are present
- Parameter types match expected types
- Parameter values are within valid ranges (where applicable)

## Examples by Use Case

### Basic Device Control
```json
// Wake up device
{}

// Sleep device
{"force": false}

// Send home button
{"keycode": 3}
```

### Application Management
```json
// Launch Unity game
{
  "package": "com.Awespire.OrientalBeauty",
  "activity": "com.unity3d.player.UnityPlayerGameActivity"
}

// Stop app
{
  "package": "com.example.app"
}

// Restart app with delay
{
  "package": "com.example.app",
  "delay": 3000
}
```

### Advanced Operations
```json
// Install and configure app
{
  "apk_path": "/apks/myapp.apk",
  "replace": true,
  "grant_permissions": true
}

// Keep device awake for 2 hours
{
  "duration_seconds": 7200
}
```

## Integration with API

When creating or updating actions via the API:

```typescript
// Frontend example
const action = {
  name: "Launch My App",
  action_type: "launch_app",
  description: "Launches my application",
  params: {
    package: "com.example.myapp",
    activity: ".MainActivity"
  }
}

await actionApi.create(action)
```

Parameters are stored in the database and automatically loaded when the action is executed. There's no need to pass parameters again during execution - only the `action_id` and `device_id` are needed.

## Troubleshooting

### Common Issues

1. **Action fails with "package name required"**
   - Solution: Ensure you're using `package` not `package_name`

2. **JSON parse error when creating action**
   - Solution: Validate JSON syntax, ensure proper quotes and commas

3. **Action executes but app doesn't launch**
   - Solution: Verify package name is correct using `adb shell pm list packages`

4. **Install APK fails**
   - Solution: Check APK path is absolute and accessible from server

## Version History

- **v1.0.0** (2026-01-07): Initial parameter specification
  - Standardized `package` parameter naming
  - Documented all action types
  - Added validation guidelines
