# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('index.html', '.'),
        ('css', 'css'),
        ('js', 'js'),
        ('server.py', '.'),
        ('.env', '.'),
        ('focusflow_logo.png', '.'),
    ],
    hiddenimports=[
        'flask',
        'webview',
        'jinja2',
        'werkzeug',
        'markupsafe',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='FocusFlowPro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
app = BUNDLE(
    exe,
    name='FocusFlowPro.app',
    icon=None,
    bundle_identifier='com.focusflowpro.app',
)
