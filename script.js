'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  distanceFromMap;

  clicks = 0; //public interface interaction
  constructor(coords, distanceFromMap, duration) {
    this.coords = coords;
    this.distanceFromMap = distanceFromMap;
    this.duration = duration;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distanceFromMap, duration, cadence) {
    super(coords, distanceFromMap, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distanceFromMap;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distanceFromMap, duration, elevationGain) {
    super(coords, distanceFromMap, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/h
    this.speed = this.distanceFromMap / (this.duration / 60);
    return this.speed;
  }
}

const run1 = new Running([39, -12], 5.2, 24, 178);
const cycling1 = new Cycling([39, -12], 27, 95, 523);
console.log(run1, cycling1);

/////////////////////////////
//Application architecture
//a class with all the methods we will need

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const resetButton = document.querySelector('.reset-btn');
const sortButton = document.querySelector('.sort-btn');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #workoutsOriginal = []; // Store the original order]
  coords = [];
  isSorted = false; // Flag to track the sort state

  constructor() {
    //getting the position of the user
    this._getPosition();

    //get data from local storage
    this._getLocalStorage();
    //attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this)); //this keyword points to form, to pint in the app we use bind method
    inputType.addEventListener('change', this._toggleElevationFireld);
    //if we click one of the workouts in the left, the map focuses over there
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    sortButton.addEventListener('click', this._sortOrResetWorkouts.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this), //calling the method loadmap js will pass the current position
        function () {
          alert('Could not retrieve your location');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);
    this.coords = [latitude, longitude];
    console.log(this.coords);

    //map is an object generated by leaflet and has some methods
    this.#map = L.map('map').setView(this.coords, this.#mapZoomLevel); //in our html we need an element with id map

    L.tileLayer('https://tile.openstreetmap.fr/hot//{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    L.marker(this.coords)
      .addTo(this.#map)
      .bindPopup('A pretty CSS popup.<br> Easily customizable.')
      .openPopup();

    //when the user clicks on the map the form is shwon ready to be completed
    this.#map.on('click', this._showForm.bind(this));

    //rending the markers, after we reload the page aand afer the map is loaded, we add the markers to the data that we have stored already from before
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  // New method to update the distance in the form
  _updateDistanceField(distance) {
    // Remove existing distance field if it exists
    const existingDistanceField = form.querySelector('.form__row--distance');
    if (existingDistanceField) {
      existingDistanceField.remove();
    }

    const distanceField = document.createElement('div');
    distanceField.className = 'form__row form__row--distance'; // Add a unique class for identification
    distanceField.innerHTML = `
    <label class="form__label">Distance</label>
    <span class="form__value">${distance}</span>
  `;
    form.insertBefore(
      distanceField,
      form.querySelector('.form__row:nth-child(2)')
    );
  }

  // Method to calculate the distance between two coordinates
  _getDistance(coords1, coords2) {
    const [lat1, lng1] = coords1;
    const [lat2, lng2] = coords2;

    const R = 6371; // Radius of the Earth in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    console.log(this.#mapEvent);

    form.classList.remove('hidden');
    const distance = this._getDistance(this.coords, [
      mapE.latlng.lat,
      mapE.latlng.lng,
    ]);
    console.log(`Koordinatat e map
      ${mapE.latlng.lat}, ${mapE.latlng.lng}`);
    this._updateDistanceField(distance); // Add this line to update the form with the calculated distance
    console.log(distance);
    inputDuration.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  //in the select button when we click running the cadence input field will change from cycling one
  //from the rows cadence and elev gain only one will be visible so we have to toggle form__row--hidden in both of them
  _toggleElevationFireld() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden'); //selecting the parent of inputfield
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  //whenever the form is submitted the marker will show up in the place the user clicked before putting the info in the form
  _newWorkout(e) {
    //getting an array of inputs and checking if the numbers are positive
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp)); //every function will retun true if all the numbers are positive

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault(); //so the page wont reload

    //get data from form
    const type = inputType.value;
    const duration = +inputDuration.value; // with the + we convert it to a numer
    const { lat, lng } = this.#mapEvent.latlng;
    const distanceFromMap = this._getDistance(this.coords, [lat, lng]); // calculate distance from map

    let workout;

    //if workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //check if data is valid.we do the oposite and it its true we return the function
      if (
        //!Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        //!Number.isFinite(cadence)
        !validInputs(duration, cadence) ||
        !allPositive(duration, cadence)
      )
        return alert('Inputs have to be positive numbers');

      workout = new Running([lat, lng], distanceFromMap, duration, cadence);
    }

    //if workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(duration, elevation) ||
        !allPositive(duration, elevation)
      )
        return alert('Inputs have to be positive numbers');
      workout = new Cycling([lat, lng], distanceFromMap, duration, elevation);
    }

    //add new object to workout array
    this.#workouts.push(workout);
    //console.log(workout);

    //render workout on map as marker
    this._renderWorkoutMarker(workout); //since werent using a call back function but were calling a function on this object we dont need the bind method

    //render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    //set local storage to all workouts
    this._setLocalStorage();
  }

  _getDistance(coords1, coords2) {
    const [lat1, lng1] = coords1;
    const [lat2, lng2] = coords2;

    const R = 6371; // Radius of the Earth in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180; // Convert to radians
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance.toFixed(1);
  }

  // New method to draw a line from the user to the workout location
  _drawLineToWorkout(workout) {
    const color = `${workout.type === 'running' ? '#00c46a' : '#ffb545'}`;
    // Draw a line from the user's location to the workout location
    L.polyline([this.coords, workout.coords], {
      color: color,
      weight: 3,
      opacity: 0.6,
      smoothFactor: 1,
      dashArray: '10, 5', // Dash pattern: 10 pixels dash, 5 pixels gap
    }).addTo(this.#map);
  }

  //render workout on map as marker
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false, //so the popup wont closse when we click somewhere else
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    // Draw the line to the workout location
    this._drawLineToWorkout(workout);
  }

  //creating some html and adding it to the dom whenever there is a new workout
  _renderWorkout(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distanceFromMap}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;
    if (workout.type === 'running')
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>`;
    if (workout.type === 'cycling')
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>`;
    //adding the html as a sibling to form, at the end of it
    form.insertAdjacentHTML('afterend', html);
  }

  //moving exactly to that popup on the map, when i click a workout in the mapty list of workouts
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout'); //select the entire li element even if the user clicks divs or spans
    console.log(workoutEl);
    if (!workoutEl) return;

    //getting exactly that li element
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    //using the public interface
    //workout.click();
  }
  //setting all workouts to a localstorage api
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    //the objects coming from the localstorage wont inhered all the methods like they dit before
    const data = JSON.parse(localStorage.getItem('workouts')); //getting an array with objects
    //console.log(data);

    if (!data) return;

    //since the method _getlocalStorage is going to be excecuted in the beggining, the workouts array will be empty
    //if we have some data in the localstorage we set the workouts array = data we had before
    this.#workoutsOriginal = [...data];

    // Set workouts to the stored data
    this.#workouts = this.#workoutsOriginal;

    //rendering them in the list, if we enter or reload the workouts will be in the left, in the list
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  //deleting all workouts out of the list
  reset() {
    localStorage.removeItem('workouts');
    location.reload(); //application will be empty
  }

  _sortOrResetWorkouts() {
    // Flag to check if workouts are sorted
    let sorted = this.isSorted;

    // Determine if we need to sort or reset
    const sort = !sorted;

    // Update the sorted state
    this.isSorted = sort;

    // Clear existing workouts in the container
    const workoutItems = containerWorkouts.querySelectorAll('.workout');
    workoutItems.forEach(item => item.remove());

    // Sort or reset workouts based on the current state
    const workoutsToDisplay = sort
      ? [...this.#workouts].sort(
          (a, b) => b.distanceFromMap - a.distanceFromMap
        )
      : [...this.#workoutsOriginal];

    // Render workouts in the current order
    workoutsToDisplay.forEach(workout => {
      this._renderWorkout(workout);
    });

    console.log(
      `Workouts ${sort ? 'sorted by distance' : 'reset to original order'}`,
      workoutsToDisplay
    );
  }
}
const app = new App();
//app.reset();
resetButton.addEventListener('click', app.reset.bind(app));
console.log(resetButton);
