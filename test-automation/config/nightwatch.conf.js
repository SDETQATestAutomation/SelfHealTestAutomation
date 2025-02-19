module.exports = {
    detailed_output :false,
    output_timestamp:true,
    live_output: true,
    disable_colors: false,
    output_folder: 'reports/',
    custom_commands_path: ['custom-commands/**'],
    page_objects_path: ['page-objects/**'],
    globals_path: '../globals/globals.js',
    src_folders: ['tests/stepdefs/hooks.js'],
    backwards_compatibility_mode: false,
  
    test_workers: false,
    webdriver: {
      start_process: true,
      server_path: require('selenium-webdriver').path,
      log_path: './',
      host: '127.0.0.1',
      port: 4444
      //cli_args: ['--verbose']
    },
    test_runner: {
      type: 'cucumber',
      options: {
        feature_path: 'tests/features/',
        additional_config: ''
      }
    },
    test_settings: {
      default: {
        launch_url: 'http://localhost',
        'selenium.host': '127.0.0.1',
        'selenium.port': 4444,
        silent: true,
        disable_colors: false,
        disable_error_log: true,
        report_network_errors: false,
        skip_testcases_on_fail: false,
        end_session_on_fail: false,
        use_xpath: true,
        screenshots: {
          enabled: true,
          on_failure: true,
          on_error: true,
          path: './screenshots'
        },
        log_screenshot_data: false,
        desiredCapabilities: {
          browserName: 'chrome',
          javascriptEnabled: true,
          acceptSslCerts: true
        }
      },
      chrome: {
        desiredCapabilities: {
          browserName: 'chrome',
          javascriptEnabled: true,
          acceptSslCerts: true,
          elementScrollBehavior: 1,
          'goog:chromeOptions': {
            w3c: true,
            args: [
              '--ignore-ssl-errors=yes',
              '--ignore-certificate-errors',
              '--allow-cross-origin-auth-prompt',
              '--allow-control-allow-origin',
              '-–allow-file-access-from-files',
              '--test-type',
              'disable-infobars',
              '--disable-extensions',
              '--start-maximized',
              '--lang=en',
              '--no-sandbox',
              'disable-popup-blocking',
            ],
            excludeSwitches: [
              'enable-automation',
              'enable-logging'
            ],
            useAutomationExtension: false,
            prefs: {
              credentials_enable_service: false,
              profile: { password_manager_enabled: false },
              extentions: {},
              download: {
                prompt_for_download: false,
                directory_upgrade: true,
                default_directory: '/downloads'
              }
            }
          },
          loggingPrefs: { driver: 'INFO', server: 'OFF', browser: 'ALL' }
        }
      },
    }
  };