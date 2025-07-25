#!/var/www/webfaces/webfaces/bin/python
import site
import os
import sys

# Add the site-packages of the chosen virtualenv to work with
site.addsitedir('/var/www/webfaces/webfaces/bin/python')

# Add the app's directory to the PYTHONPATH
sys.path.insert(0, '/var/www/webfaces')


from backend import create_app

application = create_app()
