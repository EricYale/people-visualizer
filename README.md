# people-visualizer

An art project that visualizes movement of students throughout Yale campus.

## Run the project

### Run the data pipeline
Processed data is included in the repository, but in case you want to run the data pipeline yourself, do the following:

1. Ask the Coursetable team to get you a .csv dump of student worksheets.
2. Copy `data-pipeline/.env.template` to `data-pipeline/.env`. In your Google Cloud project, enable the Google Maps Places (New) API. Create a service account, generate a secret, and paste it into the env file.
3. Run the four js files, one after the other.

### Run the frontend
Simply open the `index.html` file in your browser.

## Start kiosk mode on boot
If you are running this on an embedded system (like a RasPi) and you want the web application to start in fullscreen mode on boot, follow these steps.

1. `chmod +x kiosk/start.sh`
2. Change the paths in `kiosk/start.sh` and `kiosk/people_visualizer.service`
3. `sudo systemctl enable kiosk/people_visualizer.service`
