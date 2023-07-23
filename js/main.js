/* ---------------- melodie v1.1 ---------------- */

var app = {'name':'mélodie','version':'1.1','debug':false,'author':'','lastUpdate':'19/07/2022','description':'reproductor de música'};
fahora = new Date();
var settings = {'lastChanged':fahora.getTime(),'audioPath':'','coverPath':'','showNavPlaylists':true,'shuffle':false,'lastBackup':false,'volume':100,'mute':false,'darkmode':false,'firstSteps':true,'lang':'default'}
var player = {
	'queue': {
		'origin': '',
		'songs': [],
		'position': 0,
		'shuffle': false,
		'ended':false
	},
	'playing': {
		'status': false,
		'songId': '',
		'info': {
			'title': '',
			'artist': '',
			'album': '',
			'image': '',
			'genre': '',
			'duration': 0,
			'published': '',
			'timesPlayed': 0,
			'addedIn': '',
			'url': ''
		}
	}
}
var storageName = 'melodie-db';
var currentTab = '';
var closedAlerts = []; // listado de los alerts que han sido cerrados para esta sesión
var closedFirstSteps = false; // mostrar o no el cuadro de primeros pasos en esta sesión
var restoreOldData = {};
var seeking = false;
var seekingVol = false;
var currentPlaylist = false;
var mostPlayedListMore = false; // mostrar mas de las canciones más reproducidas
var codLang; // almacena el código ISO del idioma en que se está mostrando el contenido
var activetime = 0; // contiene el tiempo que llevas escuchando musica desde que se cargó la página
var activeTimerPlaying = false; // indica si el contador de tiempo de reproducción está activo

if (localStorage.getItem(storageName) !== null) {
	var db = JSON.parse(localStorage.getItem(storageName));
	db.app = app;
} else {
	var ahora = new Date();
	var db = {
		'app': app,
		'settings': settings,
		'songs': {},
		'playlists': {},
		'avoided': {},
	}
	localStorage.setItem(storageName,JSON.stringify(db));
}

$(function() {
	detectLang();
	showHome();
	showNavPlaylists();
	document.title = db.app.name;
	$('header h1').html(db.app.name);
	if (location.hostname == 'localhost' && db.app.debug) {
		$('header h3').html('player - dev');
	} else {
		$('header h3').html('player');
	}
	
	// preloading settings configuration
	if (db.settings.darkmode) { // detect if dark mode is enabled
		setDarkModeState();
	}
	if (db.settings.showNavPlaylists) { // detecta si mostrar las playlists en el menu lateral al cargar la pagina
		$('#navPlaylistList').show();
	} else {
		$('#navPlaylistList').hide();
	}

	$('#navOptHome,#headerRespNavOptHome').on('click',function() {
		showHome();
	});
	$('#navOptSongs,#headerRespNavOptSongs').on('click',function() {
		showSongs();
	});
	$('#navOptPlaylists').on('click',function() {
		$('#navPlaylistList').toggle(200);
	});
	$('#navOptSettings,#headerRespNavOptSettings').on('click',function() {
		showSettings();
	});
	$('#btnSaveAddSong').on('click',function(e) {
		e.stopPropagation();
		addSongValidation();
	});
	$('#btnSaveEditSong').on('click',function(e) {
		e.stopPropagation();
		editSongValidation();
	});
	$('#btnCancelAddSong').on('click',function() {
		showSongs();
	});
	$('#btnCancelEditSong').on('click',function() {
		showSongs();
	});
	$('#addSongInputImageFile').on('change',function() {
		var fullPath = document.getElementById('addSongInputImageFile').value;
		if (fullPath) {
		    var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
		    var filename = fullPath.substring(startIndex);
		    if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
		        filename = filename.substring(1);
		    }
		    $('#addSongInputImage').val(filename);
		}
	});
	$('#addSongInputUrlFile').on('change',function() {
		var fullPath = document.getElementById('addSongInputUrlFile').value;
		if (fullPath) {
		    var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
		    var filename = fullPath.substring(startIndex);
		    if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
		        filename = filename.substring(1);
		    }
		    $('#addSongInputUrl').val(filename);
		}
	});

	// ---- dialogs ----
	$('.dialogClose, .dialogOptCancel').on('click',function() {
		$('#dialogs').hide();
		$('.dialog').hide();
	});
	$('#dialogOptDeleteSongConfirm').on('click',function() {
		deleteSong($('#dialogDeleteSongId').val());
	});
	$('#dialogNewPlaylistCreate').on('click',function() {
		addPlaylist($('#dialogNewPlaylistName').val(),'default',$('#dialogNewPlSongId').val());
	});
	$('#dialogRenamePlaylistRename').on('click',function() {
		renamePlaylist($('#dialogRenamePlaylistId').val());
	});
	$('#dialogOptDeletePlaylistConfirm').on('click',function() {
		deletePlaylist($('#dialogDeletePlaylistId').val());
	});

	// ---- songs ----
	$('#btnShuffleAllSongs, #btnShufflePlaylist').on('click',function(e) {
		e.stopPropagation();
		toggleShuffle();
	});
	$('#searchBoxForm').on('submit',function(e) {
		e.preventDefault();
		searchSongs('all',$('#searchBoxContAllSongs #searchBox').val());
	});
	$('#searchBoxFormPl').on('submit',function(e) {
		e.preventDefault();
		searchSongs(currentPlaylist,$('#searchBoxContPlaylist #searchBoxPlaylist').val());
	});
	$('.inputBoxClear').on('click',function() {
		if (currentTab=='tabSongs') {
			$('#searchBox').val('');
			showSongs();
		} else if (currentTab=='tabPlaylists') {
			$('#searchBoxPlaylist').val('');
			showPlaylist(currentPlaylist);
		}
	});

	// ---- home ----
	$('#homeFirstStepsClose').on('click',function() {
		db.settings.firstSteps = false;
		localStorage.setItem(storageName,JSON.stringify(db));
		$('#tabHomeFirstSteps').hide();
		closedFirstSteps = true;
	});

	$('#homeMostPlayedMore').on('click',function() {
		console.log('event click on #homeMostPlayedMore');
		if (mostPlayedListMore) {
			$('.homeMostPlayedItemMore').hide();
			mostPlayedListMore = false;
		} else {
			$('.homeMostPlayedItemMore').css('display','flex');
			mostPlayedListMore = true;
		}
	});

	// ---- settings ----
	$('#downloadData').on('click',function() {
		var ahora = new Date();
		db.settings.lastBackup = ahora.getTime();
		localStorage.setItem(storageName,JSON.stringify(db));
		var date = new Date();
		fileName = date.toJSON().substring(0,10);
		downloadData(fileName+'-melodieData.json',JSON.stringify(db));
	});
	$('.settingsDarkModeRadio').on('change',function() {
		if (this.value == 'Activado') {
			setDarkModeState('enable');
		} else if (this.value == 'Desactivado') {
			setDarkModeState('disable');
		}
		var lastChanged = new Date();
		db.settings.lastChanged = lastChanged;
		$('#settingsLastUpdatedDate').html(lastChanged.toLocaleDateString());
		localStorage.setItem(storageName,JSON.stringify(db));
	});
	$('.settingsNavPlaylistRadio').on('change',function() {
		console.log(this.value);
		if (this.value == 'Activado') {
			db.settings.showNavPlaylists = true;
		} else if (this.value == 'Desactivado') {
			db.settings.showNavPlaylists = false;
		}
		var lastChanged = new Date();
		db.settings.lastChanged = lastChanged;
		$('#settingsLastUpdatedDate').html(lastChanged.toLocaleDateString());
		localStorage.setItem(storageName,JSON.stringify(db));
	});
	$('#settingsLastUpdatedVersion').html('v'+db.app.version);
	$('#restoreData').on('click',function() {
		$('#uploadDataFile').click();
	});
	$('#uploadDataFile').on('change',function() {
		var fullPath = document.getElementById('uploadDataFile').value;
		if (fullPath) {
		    var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
		    var filename = fullPath.substring(startIndex);
		    if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
		        filename = filename.substring(1);
		    }
		    $('#restoreInfo p').html(filename);
		    $('#restoreConfirm').show();
		}
	});
	$('#restoreConfirm').on('click',function() {
		importDataFromFile('uploadDataFile','home');
	});
	$('#settingsFileLocationSubmit').on('click',function() {
		console.log('change audio path');
		db.settings.audioPath = $('#settingsFileLocationUrl').val();
		localStorage.setItem(storageName,JSON.stringify(db));
	});
	$('#settingsCoverLocationSubmit').on('click',function() {
		console.log('change cover path');
		db.settings.coverPath = $('#settingsCoverLocationUrl').val();
		localStorage.setItem(storageName,JSON.stringify(db));
	});

	updateAvoidedSongsList();

	loadLangSelects();

	if (db.settings.coverPath=='' && db.settings.audioPath=='') {
		$('#startup').css('display','flex');
		$('#startUrlAudio').focus();

		$('#startupButtonContinue').on('click',function() {
			if ($('#startUrlAudio').val() != '' && $('#startUrlCover').val() != '') {
				db.settings.audioPath = $('#startUrlAudio').val();
				db.settings.coverPath = $('#startUrlCover').val();
				localStorage.setItem(storageName,JSON.stringify(db));
				$('#startup').css('display','none');
				$('#startupError').css('visibility','hidden');
				$('#statupError').text('');
				showHome();
			} else if ($('#startUrlAudio').val() == '' && $('#startUrlCover').val() != '') {
				// #1301 startupErr1 - you should indicate the audio files path
				errorReporting(lang[codLang].errors.general.startupErr1);
				$('#startupError').css('visibility','visible');
				$('#startupFileLocationUrl').focus();
			} else if ($('#startUrlAudio').val() != '' && $('#startUrlCover').val() == '') {
				// #1302 startupErr2 - you should indicate the disc cover file path
				errorReporting(lang[codLang].errors.general.startupErr2);
				$('#startupCoverLocationUrl').focus();
				$('#startupError').css('visibility','visible');
			} else {
				// #1303 startupErr3 - indicate the paths where the audio files and disc cover files are located
				errorReporting(lang[codLang].errors.general.startupErr3);
				$('#startupError').css('visibility','visible');
				$('#startupFileLocationUrl').focus();
			}
		});

		$('#startupButtonClear').on('click',function() {
			$('#startUrlAudio').val('');
			$('#startUrlCover').val('');
		});

		$('#startupBackupButton').on('click',function() {
		});
		$('#startupBackupButton').on('click',function() {
			$('#startupUploadDataFile').click();
		});
		$('#startupUploadDataFile').on('change',function() {
			importDataFromFile('startupUploadDataFile','home');
		});
	}

	// footer
	$('#footerControlPlay').on('click',function() {
		document.getElementById('mainPlayer').play();
		if (!activeTimerPlaying) {
			startActiveTimer();
		}
		updateTopButtons(player.queue.origin,'continue');
	});
	$('#footerControlPause').on('click',function() {
		document.getElementById('mainPlayer').pause();
		if (activeTimerPlaying) {
			stopActiveTimer();
		}
		updateTopButtons(player.queue.origin,'pause');
	});
	$('#footerControlPrev').on('click',function() {
		if(!$(this).hasClass('footerBtnDisabled')) {
			prevSong();
		}
	});
	$('#footerControlNext').on('click',function() {
		if(!$(this).hasClass('footerBtnDisabled')) {
			nextSong();
		}
	});
	$('#seekTrack').on('mousedown',function() {
		seeking = true;
	});
	$('#seekTrack').on('mousemove',function() {
		if (seeking) {
			$('#footerTrackCurrent').html(formatSeconds(this.value));
			var percentage = (this.currentTime*100)/this.duration;
		}
	});
	$('#seekTrack').on('mouseup',function() {
		seeking = false;
		document.getElementById('mainPlayer').currentTime = this.value;
	});

	$('#volumeTrack').on('mousedown',function() {
		seekingVol = true;
	});
	$('#volumeTrack').on('mousemove',function() {
		if (seekingVol) {
			$('#footerVolumeCurrent').html(this.value);
			//var percentage = (this.currentTime*100)/this.duration;
		}
	});
	$('#volumeTrack').on('mouseup',function() {
		seekingVol = false;
		db.settings.volume = this.value;
		(db.app.debug)?console.log('setting volume to '+this.value):'';
		$('#footerVolumeCurrent').html(this.value);
		document.getElementById('mainPlayer').volume = this.value/100;
		//localStorage.setItem(storageName,JSON.stringify(db));

		$('#volumeTrack').css('background-size', this.value+'% 100%');
	});
	$('#footerVolumeIcon').on('click',function() {
		toggleMute();
	});

	hideLoadScreen();
});

function detectLang() {
	(db.app.debug)?console.log('f:{detectLang()}'):'';

	if (db.settings.lang=='default') {
		var userLang = navigator.language || navigator.userLanguage;
		if (lang[userLang.substring(0,2)] != undefined) {
			db.settings.lang = userLang.substring(0,2);
		} else {
			db.settings.lang = 'en';
		}
		localStorage.setItem(storageName,JSON.stringify(db));
		(db.app.debug)?console.log('Language established as '+db.settings.lang):'';
	}
	setLang(db.settings.lang);
}

function setActiveTab(tab,plId=false) {
	(db.app.debug)?console.log('f:{setActiveTab('+tab+','+plId+')}'):'';

	currentTab = 'tab'+capitalizeFirstLetter(tab);
	$('.navOpt').removeClass('navOptActive');
	$('#navOpt'+capitalizeFirstLetter(tab)).addClass('navOptActive');

	if (currentTab == 'tabPlaylists') {
		currentPlaylist = plId;
	} else {
		currentPlaylist = false;
	}

	if (tab=='playlists' && plId!=false) {
		$('#navOptPlaylistItem-'+plId).addClass('navOptActive');
	}
}

function hideLoadScreen() {
	(db.app.debug)?console.log('f:{hideLoadScreen}'):'';

	setTimeout(function() {
		$('#loadScreen').slideUp(200);
	},3000);
}

function showHome() {
	(db.app.debug)?console.log('f:{showHome}'):'';

	var ahora = new Date();
	var lastBackup = new Date(db.settings.lastBackup);
	var diferencia = Math.floor((ahora-lastBackup) / (1000 * 60 * 60 * 24));

	$('#tabHomeAlerts').html('');
	if (!closedAlerts.includes('audioPath')) {
		if (db.settings.audioPath=='') {
			setAlert('warning','#tabHomeAlerts',lang[codLang].homePage.warnings.audioPath,function() {
				closedAlerts.push('audioPath');
			});
		}
	}
	if (!closedAlerts.includes('coverPath')) {
		if (db.settings.coverPath=='') {
			setAlert('warning','#tabHomeAlerts',lang[codLang].homePage.warnings.coverPath,function() {
				closedAlerts.push('coverPath');
			});
		}
	}

	if (!closedAlerts.includes('backupReminder')) {
		if (db.settings.lastBackup==false) {
			setAlert('warning','#tabHomeAlerts',lang[codLang].homePage.warnings.backupNever,function() {
				closedAlerts.push('backupReminder');
			});
		} else {
			if (diferencia>30) {
				setAlert('warning','#tabHomeAlerts',lang[codLang].homePage.warnings.backupMonth,function() {
					closedAlerts.push('backupReminder');
				});
			} else if (diferencia>15) {
				setAlert('info','#tabHomeAlerts',lang[codLang].homePage.warnings.backupTwoWeeks,function() {
					closedAlerts.push('backupReminder');
				});
			}
		}
	}

	$('#homeActiveTime').text(activetime+' segundos');

	//console.log(Object.keys(db.songs).length==0 || Object.keys(db.playlists).length==0 || db.settings.lastBackup==false);
	if (db.settings.firstSteps) { // determina si hay que mostrar el cuadro de los primeros pasos
		if (!closedFirstSteps) {
			$('#tabHomeFirstSteps').show();
		}
	} else {
		$('#tabHomeFirstSteps').hide();
		if (Object.keys(db.songs).length==0 || Object.keys(db.playlists).length==0 || db.settings.lastBackup==false) {
			db.settings.firstSteps = true;
			localStorage.setItem(storageName,JSON.stringify(db));
			if (!closedFirstSteps) {
				$('#tabHomeFirstSteps').show();
			}
		}
	}

	if (Object.keys(db.songs).length>0) {
		$('#firstStepsCompSongs').show();
	}
	if (Object.keys(db.playlists).length>0) {
		$('#firstStepsCompPlaylists').show();
	}
	if (db.settings.lastBackup!=false) {
		$('#firstStepsCompBackup').show();
	}

	if (Object.keys(db.songs).length>30) {
		loadSuggests(9);
	} else {
		loadSuggests(6);
	}

	// loading stats
	var statsTimesPlayed = 0;
	var statsArtists = [];
	for (i in db.songs) {
		statsTimesPlayed += db.songs[i].timesPlayed;
		if (!statsArtists.includes(db.songs[i].artist)) {
			statsArtists.push(db.songs[i].artist);
		}
	}
	$('#homeStatsSongs p').text(Object.keys(db.songs).length);
	$('#homeStatsPlayed p').text(statsTimesPlayed);
	$('#homeStatsArtists p').text(statsArtists.length);
	$('#homeStatsPlaylists p').text(Object.keys(db.playlists).length);

	if (Object.keys(db.songs).length > 8) { // if the total number of songs is less than 10 this function doesn't apply
		notPlayedSongs();
	}
	mostPlayedList();

	$('.tab').hide();
	$('#tabHome').show();
	setActiveTab('home');
}

function showNavPlaylists() {
	(db.app.debug)?console.log('f:{showNavPlaylists}'):'';

	var htmlPlaylists = '';
	var totalPlaylists = 0;
	if (Object.keys(db.playlists).length != 0) {
		for (i in db.playlists) {
			htmlPlaylists += '<div class="navOpt navOptPlaylistItem" id="navOptPlaylistItem-'+i+'">';
				htmlPlaylists += '<p>'+db.playlists[i].name+'</p>';
				htmlPlaylists += '<svg class="navOptPlaying" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="23.7" height="36" viewBox="0 0 23.7 36"><title>reproduciendo</title><path d="M19.65,42a7.54,7.54,0,0,1-5.33-12.83A7.3,7.3,0,0,1,19.65,27a7.4,7.4,0,0,1,2.52.4,6.57,6.57,0,0,1,2,1.1V6h11.7v6.75h-8.7V34.5a7.43,7.43,0,0,1-7.5,7.5Z" transform="translate(-12.15 -6)"/></svg>';
			htmlPlaylists += '</div>';
		}
	} else {
		htmlPlaylists += '<div id="navOptPlaylistItemNull"><p>'+lang[codLang].nav.noPlaylists+'</p></div>';
	}

	$('#navPlaylistList').html(htmlPlaylists);

	$('.navOptPlaylistItem').on('click',function() {
		showPlaylist($(this).attr('id').substring(19));
	});
}

function showSongs() {
	(db.app.debug)?console.log('f:{showSongs}'):'';

	var htmlSongs = '';
	var totalDuration = 0; // en segundos
	var songOrder = sortSongs(db.songs);

	if (Object.keys(db.songs).length != 0) {
		var count = Object.keys(db.songs).length;
		for (i in songOrder) {
			var fecha = new Date(db.songs[songOrder[i]].addedIn);
			var minutes = Math.floor(db.songs[songOrder[i]].duration/60);
			var seconds = db.songs[songOrder[i]].duration - (minutes*60);
			
			// asign classes to each item if they are playing or not and if they are avoided or not
			if (player.playing.songId==songOrder[i]) {
				if (db.avoided[songOrder[i]]==undefined) {
					htmlSongs += '<div class="allSongsItem allSongsItemPlaying" id="allSongsItem-'+songOrder[i]+'">';
				} else {
					htmlSongs += '<div class="allSongsItem allSongsItemPlaying allSongsItemAvoided" id="allSongsItem-'+songOrder[i]+'">';
				}
			} else {
				if (db.avoided[songOrder[i]]==undefined) {
					htmlSongs += '<div class="allSongsItem" id="allSongsItem-'+songOrder[i]+'">';
				} else {
					htmlSongs += '<div class="allSongsItem allSongsItemAvoided" id="allSongsItem-'+songOrder[i]+'">';
				}				
			}
			if (db.avoided[songOrder[i]]==undefined) {
				htmlSongs += '<div class="songsRow" id="songsRowOrder"><p>'+count+'</p></div>';
			} else {
				htmlSongs += '<div class="songsRow" id="songsRowOrder">';
					htmlSongs += '<svg class="iconSongAvoided" id="Capa_1" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><title>Canción evitada</title><path d="M24,44a19.29,19.29,0,0,1-7.8-1.58A19.91,19.91,0,0,1,5.58,31.8a20.1,20.1,0,0,1,0-15.6A20,20,0,0,1,16.2,5.58a20.1,20.1,0,0,1,15.6,0,20.42,20.42,0,0,1,6.35,4.28,20.05,20.05,0,0,1,4.27,6.35A19.29,19.29,0,0,1,44,24a19.29,19.29,0,0,1-1.58,7.8A19.91,19.91,0,0,1,31.8,42.42,19.29,19.29,0,0,1,24,44Zm0-3a16.41,16.41,0,0,0,12-5,16.41,16.41,0,0,0,5-12,16.55,16.55,0,0,0-1-5.85,17.56,17.56,0,0,0-3-5.1L13.05,37a15.9,15.9,0,0,0,5.08,3A16.91,16.91,0,0,0,24,41ZM11.05,35,35,11.05a17.05,17.05,0,0,0-5.1-3A16.55,16.55,0,0,0,24,7,16.41,16.41,0,0,0,12,12,16.41,16.41,0,0,0,7,24a16.19,16.19,0,0,0,1.1,5.88A18.52,18.52,0,0,0,11.05,35Z" transform="translate(-4 -4)"/></svg>';
				htmlSongs += '</div>';
			}
				htmlSongs += '<div class="songsRow" id="songsRowImage"><img src="'+db.settings.coverPath+'/'+db.songs[songOrder[i]].image+'" /></div>';
				htmlSongs += '<div class="songsRow" id="songsRowTitle"><p>'+db.songs[songOrder[i]].title+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowArtist"><p>'+db.songs[songOrder[i]].artist+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowAlbum"><p>'+db.songs[songOrder[i]].album+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowGenre"><p>'+db.songs[songOrder[i]].genre+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowDuration"><p>'+minutes+':'+twoDigits(seconds)+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowAddedIn"><p>'+twoDigits(fecha.getDate())+'/'+twoDigits(fecha.getMonth()+1)+'/'+fecha.getFullYear()+'</p></div>';
				htmlSongs += '<div class="songsRow" id="songsRowActions"><p></p></div>';
				htmlSongs += '<input class="songsUrl" type="hidden" value="'+db.songs[songOrder[i]].url+'" />';
				htmlSongs += '<input class="songsOrigin" type="hidden" value="all" />'; // almacena información sobre la lista donde está contenida
			htmlSongs += '</div>';
			totalDuration += db.songs[songOrder[i]].duration;
			count--;
		}
	} else {
		htmlSongs += '<div class="allSongsItem allSongsNoResults">';
			htmlSongs += '<p>'+lang[codLang].mySongs.noSongs+'</p>';
		htmlSongs += '</div>';
	}

	if (Object.keys(db.songs).length!=1) {
		var numCanciones = Object.keys(db.songs).length+' '+lang[codLang].mySongs.songs[1];
	} else {
		var numCanciones = Object.keys(db.songs).length+' '+lang[codLang].mySongs.songs[0];
	}
	totalDuration=totalDuration;
	var totalHoras = Math.floor(totalDuration/3600);
	var totalMinutos = Math.floor((totalDuration - (totalHoras*3600))/60);
	if (totalHoras!=1) {var totalHorasTxt=lang[codLang].mySongs.hours[1]} else {var totalHorasTxt=lang[codLang].mySongs.hours[0]};
	if (totalMinutos!=1) {var totalMinutosTxt=lang[codLang].mySongs.minutes[1]} else {var totalMinutosTxt=lang[codLang].mySongs.minutes[0]};

	if (totalHoras>0) {
		$('#songsTopInfo').html(numCanciones+' ('+totalHoras+' '+totalHorasTxt+' y '+totalMinutos+' '+totalMinutosTxt+')');
	} else {
		$('#songsTopInfo').html(numCanciones+' ('+totalMinutos+' '+totalMinutosTxt+')');
	}
	$('#listAllSongs').html(htmlSongs);

	if (db.settings.shuffle) {
		$('#btnShuffleAllSongs').addClass('btnShuffleAllSongsActive');
	} else {
		$('#btnShuffleAllSongs').removeClass('btnShuffleAllSongsActive');
	}

	$('.allSongsItem').on('click',function() {
		if (!$(this).hasClass('allSongsNoResults')) {
			playSongItem($(this).find('.songsOrigin').val(),$(this).attr('id').substring(13));
		}
	});
	$('#btnPlayAllSongs').on('click',function() {
		if (db.settings.shuffle) {
			setSongQueue('all',false,true);
		} else {
			setSongQueue('all',false,false);
		}
		if (!activeTimerPlaying) {
			startActiveTimer();
		}
		updateTopButtons('all','play');
	});
	$('#btnPauseAllSongs').on('click',function() {
		document.getElementById('mainPlayer').pause();
		if (activeTimerPlaying) {
			stopActiveTimer();
		}
		updateTopButtons('all','pause');
	});
	$('#btnContinueAllSongs').on('click',function() {
		document.getElementById('mainPlayer').play();
		if (!activeTimerPlaying) {
			startActiveTimer();
		}
		updateTopButtons('all','continue');
	});

	$('#btnAddSong').on('click',function() {
		console.log('addSong');
		showAddSongDialog();
	});

	$('.tab').hide();
	$('#tabSongs').show();
	setActiveTab('songs');
}

function showPlaylist(id) {
	(db.app.debug)?console.log('f:{showPlaylist('+id+')}'):'';

	$('#playlistTopLeft h2').text(db.playlists[id].name);

	var htmlPlaylistSongs = '';
	var totalDuration = 0; // en segundos

	if (db.playlists[id].songs.length != 0) {
		var count = 1;

		for (i in db.playlists[id].songs) {
			var minutes = Math.floor(db.songs[db.playlists[id].songs[i]].duration/60);
			var seconds = db.songs[db.playlists[id].songs[i]].duration - (minutes*60);
			if (player.playing.songId==db.playlists[id].songs[i]) {
				if (db.avoided[db.playlists[id].songs[i]]==undefined) {
					htmlPlaylistSongs += '<div class="allSongsItem allSongsItemPlaying" id="playlistSongsItem-'+db.playlists[id].songs[i]+'-'+id+'">';
				} else {
					htmlPlaylistSongs += '<div class="allSongsItem allSongsItemAvoided allSongsItemPlaying" id="playlistSongsItem-'+db.playlists[id].songs[i]+'-'+id+'">';
				}
			} else {
				if (db.avoided[db.playlists[id].songs[i]]==undefined) {
					htmlPlaylistSongs += '<div class="allSongsItem" id="playlistSongsItem-'+db.playlists[id].songs[i]+'-'+id+'">';
				} else {
					htmlPlaylistSongs += '<div class="allSongsItem allSongsItemAvoided" id="playlistSongsItem-'+db.playlists[id].songs[i]+'-'+id+'">';
				}
			}
			if (db.avoided[db.playlists[id].songs[i]]==undefined) {
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowOrder"><p>'+count+'</p></div>';
			} else {
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowOrder">';
					htmlPlaylistSongs += '<svg class="iconSongAvoided" id="Capa_1" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><title>Canción evitada</title><path d="M24,44a19.29,19.29,0,0,1-7.8-1.58A19.91,19.91,0,0,1,5.58,31.8a20.1,20.1,0,0,1,0-15.6A20,20,0,0,1,16.2,5.58a20.1,20.1,0,0,1,15.6,0,20.42,20.42,0,0,1,6.35,4.28,20.05,20.05,0,0,1,4.27,6.35A19.29,19.29,0,0,1,44,24a19.29,19.29,0,0,1-1.58,7.8A19.91,19.91,0,0,1,31.8,42.42,19.29,19.29,0,0,1,24,44Zm0-3a16.41,16.41,0,0,0,12-5,16.41,16.41,0,0,0,5-12,16.55,16.55,0,0,0-1-5.85,17.56,17.56,0,0,0-3-5.1L13.05,37a15.9,15.9,0,0,0,5.08,3A16.91,16.91,0,0,0,24,41ZM11.05,35,35,11.05a17.05,17.05,0,0,0-5.1-3A16.55,16.55,0,0,0,24,7,16.41,16.41,0,0,0,12,12,16.41,16.41,0,0,0,7,24a16.19,16.19,0,0,0,1.1,5.88A18.52,18.52,0,0,0,11.05,35Z" transform="translate(-4 -4)"/></svg>';
				htmlPlaylistSongs += '</div>';
			}
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowImage"><img src="'+db.settings.coverPath+'/'+db.songs[db.playlists[id].songs[i]].image+'" /></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowTitle"><p>'+db.songs[db.playlists[id].songs[i]].title+'</p></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowArtist"><p>'+db.songs[db.playlists[id].songs[i]].artist+'</p></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowAlbum"><p>'+db.songs[db.playlists[id].songs[i]].album+'</p></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowGenre"><p>'+db.songs[db.playlists[id].songs[i]].genre+'</p></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowDuration"><p>'+minutes+':'+twoDigits(seconds)+'</p></div>';
				htmlPlaylistSongs += '<div class="songsRow" id="songsRowActions"><p></p></div>';
				htmlPlaylistSongs += '<input class="songsUrl" type="hidden" value="'+db.songs[db.playlists[id].songs[i]].url+'" />';
				htmlPlaylistSongs += '<input class="songsOrigin" type="hidden" value="'+id+'" />'; // almacena información sobre la lista donde está contenida
			htmlPlaylistSongs += '</div>';
			totalDuration += db.songs[db.playlists[id].songs[i]].duration;
			count++;
		}
	} else {
		htmlPlaylistSongs += '<div class="allSongsItem allSongsNoResults">';
			htmlPlaylistSongs += '<p>'+lang[codLang].mySongs.noSongs+'</p>';
		htmlPlaylistSongs += '</div>';
	}

	if (Object.keys(db.playlists[id].songs).length!=1) {
		var numCanciones = Object.keys(db.playlists[id].songs).length+' '+lang[codLang].mySongs.songs[1];
	} else {
		var numCanciones = Object.keys(db.playlists[id].songs).length+' '+lang[codLang].mySongs.songs[0];
	}
	totalDuration=totalDuration;
	var totalHoras = Math.floor(totalDuration/3600);
	var totalMinutos = Math.floor((totalDuration - (totalHoras*3600))/60);
	if (totalHoras!=1) {var totalHorasTxt=lang[codLang].mySongs.hours[1]} else {var totalHorasTxt=lang[codLang].mySongs.hours[0]};
	if (totalMinutos!=1) {var totalMinutosTxt=lang[codLang].mySongs.minutes[1]} else {var totalMinutosTxt=lang[codLang].mySongs.minutes[0]};

	if (totalHoras>0) {
		$('#playlistTopInfo').html(numCanciones+' ('+totalHoras+' '+totalHorasTxt+' y '+totalMinutos+' '+totalMinutosTxt+')');
	} else {
		$('#playlistTopInfo').html(numCanciones+' ('+totalMinutos+' '+totalMinutosTxt+')');
	}
	$('#listAllPlaylistSongs').html(htmlPlaylistSongs);

	if (player.queue.origin == id) {
		$('#tabPlaylists .tabTopLeftTitle svg').show();
	} else {
		$('#tabPlaylists .tabTopLeftTitle svg').hide();
	}

	if (db.settings.shuffle) {
		$('#btnShufflePlaylist').addClass('btnShuffleAllSongsActive');
	} else {
		$('#btnShufflePlaylist').removeClass('btnShuffleAllSongsActive');
	}

	$('.allSongsItem').on('click',function() {
		if (!$(this).hasClass('allSongsNoResults')) {
			//console.log($(this).find('.songsOrigin').val(),$(this).attr('id').split('-')[1]);
			playSongItem($(this).find('.songsOrigin').val(),$(this).attr('id').split('-')[1]);
		}
	});

	$('#btnPlayPlaylist').on('click',function() {
		if (db.settings.shuffle) {
			setSongQueue(id,false,true);
		} else {
			setSongQueue(id,false,false);
		}
		updateTopButtons(id,'play');
	});
	$('#btnPausePlaylist').on('click',function() {
		document.getElementById('mainPlayer').pause();
		updateTopButtons(id,'pause');
	});
	$('#btnContinuePlaylist').on('click',function() {
		document.getElementById('mainPlayer').play();
		updateTopButtons(id,'continue');
	});

	if (player.queue.origin != id) {
		if (player.queue.origin!='all') {
			updateTopButtons(id,'reset');
		}
	} else {
		if (document.getElementById('mainPlayer').paused) {
			updateTopButtons(id,'pause');
		} else {
			updateTopButtons(id,'continue');
		}
	}

	$('.tab').hide();
	$('#tabPlaylists').show();
	setActiveTab('playlists',id);
}

function showSettings() {
	(db.app.debug)?console.log('f:{showSettings}'):'';

	if (db.settings.showNavPlaylists) {
		$('input.settingsNavPlaylistRadio[value="Activado"]').attr('checked','checked');
	} else {
		$('input.settingsNavPlaylistRadio[value="Desactivado"]').attr('checked','checked');
	}
	if (db.settings.darkmode) {
		$('input.settingsDarkModeRadio[value="Activado"]').attr('checked','checked');
	} else {
		$('input.settingsDarkModeRadio[value="Desactivado"]').attr('checked','checked');
	}

	if (db.settings.lastBackup==false) {
		$('#lastDownload p').text(lang[codLang].settings.backup.noLastBackup);
	} else {
		var fecha = new Date(db.settings.lastBackup);
		$('#tabSettings #lastDownload p').text(lang[codLang].settings.backup.lastBackup.replace('%%',fecha.toLocaleDateString()));
	}
	var lastChanged = new Date(db.settings.lastChanged);
	$('#settingsLastUpdated p:first-child').html(lang[codLang].settings.lastUpdated.replace('%%','<span id="settingsLastUpdatedDate">'+lastChanged.toLocaleDateString()+'</span>'));

	$('#settingsFileLocationUrl').val(db.settings.audioPath);
	$('#settingsCoverLocationUrl').val(db.settings.coverPath);

	// get available storage
	var _lsTotal = 0,
	_xLen, _x;
	for (_x in localStorage) {
		if (!localStorage.hasOwnProperty(_x)) {
			continue;
		}
		_xLen = ((localStorage[_x].length + _x.length) * 2);
		_lsTotal += _xLen;
		if (_x.substr(0,50) == 'melodie-db') {
			$('#settingsItemSpace #settingsSpaceApp').html(lang[codLang].settings.availableStorage.appUsage.replace('%%',db.app.name).replace('%%',(_xLen / 1024).toFixed(2) + ' KB'));
		}
	};
	var totalUsed = _lsTotal;
	var totalLocalstorage = 5242880; // 10MB en bytes
	
	$('#settingsItemSpace #settingsSpaceTotal').html(lang[codLang].settings.availableStorage.localstorageUsage.replace('%%',(totalUsed / 1024).toFixed(2) + ' KB'));

	var spacePercentage = (totalUsed*100)/totalLocalstorage;
	$('#settingsSpaceBarFill').css('width',spacePercentage+'%');
	$('#settingsSpaceNumber').text(spacePercentage.toFixed(2)+'%');

	$('.tab').hide();
	$('#tabSettings').show();
	setActiveTab('settings');
}

function playSongItem(origin,songId) {
	(db.app.debug)?console.log('f:{playSongItem('+origin+','+songId+')}'):'';

	if (origin == player.queue.origin && player.queue.ended==false) {
		player.queue.position = player.queue.songs.indexOf(songId);
		playNextSong();
	} else {
		if (db.settings.shuffle) {
			setSongQueue(origin,songId,true);
		} else {
			setSongQueue(origin,songId,false);
		}
	}
}

function setSongQueue(origin,songId,shuffle) {
	(db.app.debug)?console.log('f:{setSongQueue('+origin+','+songId+','+shuffle+')}'):'';

	clearSongQueue(); // resetea todos los valores del player a los por defecto
	if (origin=='all') {
		var arraySongs = [];
		for (i in db.songs) {
			arraySongs.push(i);
		}
		player.queue.origin = 'all';
		if (shuffle) {
			if (songId==false) {
				player.queue.songs = shuffleSongList(arraySongs);
			} else { // el modo shuffle está activado pero el usuario ha seleccionado la primera canción a reproducir
				arraySongs.splice(arraySongs.indexOf(songId),1);
				var provisionalShuffle = shuffleSongList(arraySongs);
				provisionalShuffle.unshift(songId); // añade la canción inicial al principio del array
				player.queue.songs = provisionalShuffle;
			}
		} else {
			player.queue.songs = arraySongs;
		}
		if (currentTab!='tabSongs') { showSongs(); }
	} else {
		if (origin in db.playlists) {
			if (db.playlists[origin].songs.includes(songId) || songId==false) {
				var arraySongs = db.playlists[origin].songs;
				player.queue.origin = origin;
				if (shuffle) {
					if (songId==false) {
						player.queue.songs = shuffleSongList(arraySongs);
					} else {
						arraySongs.splice(arraySongs.indexOf(songId),1);
						var provisionalShuffle = shuffleSongList(arraySongs);
						provisionalShuffle.unshift(songId); // añade la canción inicial al principio del array
						player.queue.songs = provisionalShuffle;
					}
				} else {
					player.queue.songs = arraySongs;
				}
				if (currentTab!='tabPlaylists') { showPlaylist(origin); }
			} else {
				// #5002 playlistErr2 - this playlist does not have the selected song
				errorReporting(lang[codLang].errors.player.playlistErr2);
			}
		} else {
			// #5001 playlistErr1 - the played playlist does not exist
			errorReporting(lang[codLang].errors.player.playlistErr1);
		}
	}

	player.playing.status = false;
	if (!shuffle && origin=='all') { player.queue.songs.reverse(); }
	if (songId==false) {
		player.queue.position = 0;
	} else {
		if (player.queue.songs.indexOf(songId) == -1) {
			player.queue.position = 0;
		} else {
			player.queue.position = player.queue.songs.indexOf(songId);
		}
	}

	if (shuffle) {
		player.queue.shuffle = true;
	} else {
		player.queue.shuffle = false;
	}

	$('.navOpt .navOptPlaying').hide();
	$('.tabTopLeftTitle svg').hide();
	if (player.queue.origin == 'all') {
		$('#navOptSongs .navOptPlaying').show();
		$('#tabSongs .tabTopLeftTitle svg').show();
	} else {
		$('#navOptPlaylistItem-'+player.queue.origin+' .navOptPlaying').show();
		$('#tabPlaylists .tabTopLeftTitle svg').show();
	}

	(db.app.debug)?console.log(player):'';
	playNextSong();
}

function clearSongQueue() {
	(db.app.debug)?console.log('f:{clearSongQueue}'):'';

	player.queue.origin = '';
	player.queue.songs = [];
	player.queue.position = 0;
	player.queue.shuffle = false;
	player.playing.status = false;
	player.playing.info = {
		'title': '',
		'artist': '',
		'album': '',
		'image': '',
		'genre': '',
		'duration': 0,
		'published': '',
		'timesPlayed': 0,
		'addedIn': '',
		'url': ''
	};

	$('#footerSongImage img').attr('src','img/defaultSong.svg');
	$('#footerSongTitle').html('');
	$('#footerSongArtist').html('');
	$('#footerAudio').html('');
}

function playNextSong() {
	(db.app.debug)?console.log('f:{playNextSong}'):'';

	if (player.queue.position < player.queue.songs.length) {
		var songId = player.queue.songs[player.queue.position];
		if (db.avoided[songId]!=undefined) {
			player.queue.position++;
			songId = player.queue.songs[player.queue.position];
			(db.app.debug)?console.log('the song '+db.songs[songId].title+' has been avoided'):'';
			playNextSong();
		} else {
			(db.app.debug)?console.log('playing song: '+songId):'';
			(db.app.debug)?console.log(db.songs[songId]):'';
			(db.app.debug)?console.log(player.queue):'';

			player.queue.ended = false;
			player.playing.songId = songId;
			player.playing.info = {
				'title': db.songs[songId].title,
				'artist': db.songs[songId].artist,
				'album': db.songs[songId].album,
				'image': db.songs[songId].image,
				'genre': db.songs[songId].genre,
				'duration': db.songs[songId].duration,
				'published': db.songs[songId].published,
				'timesPlayed': db.songs[songId].timesPlayed,
				'addedIn': db.songs[songId].addedIn,
				'url': db.songs[songId].url
			};
			player.playing.status = true;

			if (player.playing.info.image != '') {
				$('#footerSongImage img').attr('src',db.settings.coverPath+'/'+player.playing.info.image);
			} else {
				$('#footerSongImage img').attr('src','img/defaultSong.svg');
			}
			$('#footerSongTitle').html(player.playing.info.title);
			$('#footerSongArtist').html(player.playing.info.artist);

			//console.log(player.playing.songId);

			$('.allSongsItem').removeClass('allSongsItemPlaying');
			updateTopButtons('all','reset');
			if (player.queue.origin=='all') {
				$('#allSongsItem-'+player.playing.songId).addClass('allSongsItemPlaying');
				$('#btnPlayAllSongs').hide();$('#btnPauseAllSongs').css('display','flex');
			} else {
				$('#playlistSongsItem-'+player.playing.songId+'-'+player.queue.origin).addClass('allSongsItemPlaying');
				$('#btnPlayPlaylist').hide();$('#btnPausePlaylist').css('display','flex');
			}
			$('#footerControlPlay').hide();$('#footerControlPause').show();

			$('#footerAudio').html('<audio id="mainPlayer" controls autoplay src="'+db.settings.audioPath+'/'+player.playing.info.url+'"></audio>');
			if (player.queue.position==0) {
				$('#footerControlPrev').addClass('footerBtnDisabled');
				$('#footerControlPrev').attr('title','');
			} else {
				$('#footerControlPrev').removeClass('footerBtnDisabled');
				$('#footerControlPrev').attr('title',db.songs[player.queue.songs[player.queue.position-1]].title+' - '+db.songs[player.queue.songs[player.queue.position-1]].artist);
			}
			if (player.queue.songs.length <= player.queue.position+1) {
				$('#footerControlNext').addClass('footerBtnDisabled');
				$('#footerControlNext').attr('title','');
			} else {
				$('#footerControlNext').removeClass('footerBtnDisabled');
				$('#footerControlNext').attr('title',db.songs[player.queue.songs[player.queue.position+1]].title+' - '+db.songs[player.queue.songs[player.queue.position+1]].artist);
			}
			
			$('#footerSeekTrack').css('visibility','visible');
			$('#footerControlsCenter').css('visibility','visible');
			$('#footerSeekVolume').css('visibility','visible');
			if (db.settings.mute) {
				$('#volumeTrack').val(0);
				$('#footerVolumeCurrent').text('0');
				document.getElementById('mainPlayer').volume = 0;
				$('#footerVolumeIcon').html('<svg xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="m33.583 37.667-5.333-5.334q-1.125.75-2.417 1.313-1.291.562-2.708.896v-2.875q.833-.25 1.625-.563.792-.312 1.5-.771l-6.458-6.458v9.458L11.458 25H4.792V15h6.125L2.125 6.208l2-1.958 31.417 31.417ZM32.458 28l-2-2q.792-1.375 1.188-2.896.396-1.521.396-3.146 0-4.166-2.438-7.458-2.437-3.292-6.479-4.25V5.375q5.167 1.167 8.417 5.229 3.25 4.063 3.25 9.354 0 2.167-.584 4.209-.583 2.041-1.75 3.833Zm-5.583-5.583-3.75-3.75V13.25q1.958.917 3.063 2.75 1.104 1.833 1.104 4 0 .625-.104 1.229-.105.604-.313 1.188Zm-7.083-7.084L15.458 11l4.334-4.333Zm-2.75 11.25v-5.458l-3.334-3.333H7.583v4.416h5.084Zm-1.667-7.125Z"/></svg>');
			} else {
				$('#volumeTrack').val(db.settings.volume);
				$('#footerVolumeCurrent').text(db.settings.volume);
				document.getElementById('mainPlayer').volume = parseInt(db.settings.volume)/100;
				$('#footerVolumeIcon').html('<svg xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="M23.333 34.542v-2.875q3.959-1.125 6.417-4.355 2.458-3.229 2.458-7.354t-2.458-7.375q-2.458-3.25-6.417-4.333V5.375q5.167 1.167 8.417 5.229Q35 14.667 35 19.958q0 5.292-3.25 9.354-3.25 4.063-8.417 5.23ZM5 25V15h6.667L20 6.667v26.666L11.667 25Zm17.792 1.875V13.042q2.166.791 3.437 2.708Q27.5 17.667 27.5 20q0 2.292-1.292 4.208-1.291 1.917-3.416 2.667Zm-5.584-13.292-4.333 4.209H7.792v4.416h5.083l4.333 4.25Zm-4 6.417Z"/></svg>');
			}
			$('#volumeTrack').css('background-size', $('#volumeTrack').val()+'% 100%');

			db.songs[player.playing.songId].timesPlayed++;
			var dateLastPlayed = new Date();
			db.songs[player.playing.songId].lastPlayed = dateLastPlayed.getTime();
			localStorage.setItem(storageName,JSON.stringify(db));

			navigator.mediaSession.metadata = new MediaMetadata({
				title: player.playing.info.title,
				artist: player.playing.info.artist,
				album: player.playing.info.album,
				artwork: [{
					src: player.playing.info.image,
					sizes: '350x350',
					type: 'image/jpg'
				}]
			});

			if (!activeTimerPlaying) {
				startActiveTimer(); // counts the time while the song is playing
			}

			$('#mainPlayer').on('ended',function() {
				player.queue.position++;
				endSong();
				playNextSong();
			});

			$('#mainPlayer').on('error', function() {
				// #1201 playSongErr1 - The song could not be played
				errorReporting(lang[codLang].errors.general.playSongErr1);

				var errorSongId = player.playing.songId;

				setTimeout(function() {
					if (player.playing.songId == errorSongId) {
						console.log('se mantiene la misma canción');
						db.songs[player.playing.songId].timesPlayed++; // the song has not been played, so shouldn't count
						player.queue.position++;
						endSong();
						playNextSong();
					} else {
						console.log('ha cambiado la canción. No hacer nada');
					}
				},5000);
			});

			$('#mainPlayer').on('timeupdate',function() { // se ejecuta constantemente mientras el audio se está reproduciendo
				var currentTime = this.currentTime;
			    var duration = this.duration;

			    if ((parseInt($('#footerTrackEnd').html().split(':')[0])*60)+parseInt($('#footerTrackEnd').html().split(':')[1]) != Math.floor(this.duration)) {
			    	$('#footerTrackEnd').html(formatSeconds(this.duration));
					$('#seekTrack').attr('max',Math.floor(this.duration));
			    }

				if (!seeking) {
					if ((parseInt($('#footerTrackCurrent').html().split(':')[0])*60)+parseInt($('#footerTrackCurrent').html().split(':')[1]) != Math.floor(this.currentTime)) {
						$('#footerTrackCurrent').html(formatSeconds(this.currentTime));
					}
					var percentage = (this.currentTime*100)/this.duration;
					$('#seekTrack').css('background-size', percentage+'% 100%');
					$('#seekTrack').val(currentTime);
				}
			});
		}
	} else {
		console.log('se han reproducido todas las canciones de la playlist');
		endPlaylist();
	}
}

function endSong() {
	(db.app.debug)?console.log('f:{endSong}'):'';

	player.playing.status = false;
	player.playing.songId = '';
	player.playing.info = {
		'title': '',
		'artist': '',
		'album': '',
		'image': '',
		'genre': '',
		'duration': 0,
		'published': '',
		'timesPlayed': 0,
		'addedIn': '',
		'url': ''
	};
	player.queue.ended = true;
	$('.allSongsItem').removeClass('allSongsItemPlaying');
	$('#footerAudio').html('');
	$('#footerSeekTrack').css('visibility','hidden');
	$('#footerSeekVolume').css('visibility','hidden');
	$('#footerControlsCenter').css('visibility','hidden');
}

function endPlaylist() {
	(db.app.debug)?console.log('f:{endPlaylist}'):'';

	$('.allSongsItem').removeClass('allSongsItemPlaying');
	//$('.btnPlay').css('display','flex');$('.btnPause').hide();
	updateTopButtons('all','reset');

	// quitar indicador de playlist en reproducción (nav y tabTop)
	$('#navOptSongs .navOptPlaying').hide();
	$('#tabSongs .tabTopLeftTitle svg').hide();
	$('.navOptPlaylistItem .navOptPlaying').hide();
	$('#tabPlaylists .tabTopLeftTitle svg').hide();

	// reestablecer los datos de la cola en el player
	player.queue = {
		'origin': '',
		'songs': [],
		'position': 0,
		'shuffle': false,
		'ended':false
	};

	if (activeTimerPlaying) {
		stopActiveTimer(); // stops counting the time playing songs
	}

	$('#footerSongImage img').attr('src','img/defaultSong.svg');
	$('#footerSongTitle').html('');
	$('#footerSongArtist').html('');
}

function addSongtoQueue(origin,songId) {
	(db.app.debug)?console.log('f:{addSongtoQueue('+origin+','+songId+')}'):'';

	if (origin=='all') {
		player.queue.songs.unshift(songId);
		if (player.queue.position==0) {
			$('#footerControlPrev').removeClass('footerBtnDisabled');
			$('#footerControlPrev').attr('title',db.songs[songId].title+' - '+db.songs[songId].artist);
		}
		player.queue.position++;
	} else {
		if (player.queue.position+2 == player.queue.songs.length) {
			$('#footerControlNext').removeClass('footerBtnDisabled');
			$('#footerControlNext').attr('title',db.songs[songId].title+' - '+db.songs[songId].artist);
		}
	}
}

function prevSong() {
	(db.app.debug)?console.log('f:{prevSong}'):'';

	if (player.queue.position != 0) {
		player.queue.position--;
		endSong();
		playNextSong();
	}
}

function nextSong() {
	(db.app.debug)?console.log('f:{nextSong}'):'';

	if (player.queue.songs.length > player.queue.position+1) {
		player.queue.position++;
		endSong();
		playNextSong();
	}
}

function rewindSong(s)  {
	(db.app.debug)?console.log('f:{rewindSong('+s+')}'):'';

	if (player.queue.origin!='') {
		document.getElementById('mainPlayer').value;
		document.getElementById('mainPlayer').currentTime -= s;
	}
}

function forwardSong(s) {
	(db.app.debug)?console.log('f:{forwardSong('+s+')}'):'';

	if (player.queue.origin!='') {
		document.getElementById('mainPlayer').value;
		document.getElementById('mainPlayer').currentTime += s;
	}
}

function songSeekPart(part) {
	(db.app.debug)?console.log('f:{songSeekPart()}'):'';

	if (part>=0 && part<10) {
		splitedTime = document.getElementById('mainPlayer').duration / 10;
		totalTime = splitedTime * part;
		console.log('seeking to decile '+part+': '+totalTime);
		document.getElementById('mainPlayer').currentTime = totalTime;
	}
}

function setVolume(vol) {
	(db.app.debug)?console.log('f:{setVolume('+vol+')}'):'';

	if (player.queue.origin!='') {
		db.settings.volume = vol;
		$('#footerVolumeCurrent').html(vol);
		document.getElementById('mainPlayer').volume = vol/100;
		console.log(vol/100);
		//localStorage.setItem(storageName,JSON.stringify(db));

		document.getElementById('volumeTrack').value = vol;
		$('#volumeTrack').css('background-size', vol+'% 100%');

		if (vol!=0 && db.settings.mute) {
			toggleMute();
		}

		if (vol==0) { // si el nuevo volumen es cero mostramos el altavoz en silencio, sino lo quitamos
			$('#footerVolumeIcon').html('<svg class="volumeZero" xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="m33.583 37.667-5.333-5.334q-1.125.75-2.417 1.313-1.291.562-2.708.896v-2.875q.833-.25 1.625-.563.792-.312 1.5-.771l-6.458-6.458v9.458L11.458 25H4.792V15h6.125L2.125 6.208l2-1.958 31.417 31.417ZM32.458 28l-2-2q.792-1.375 1.188-2.896.396-1.521.396-3.146 0-4.166-2.438-7.458-2.437-3.292-6.479-4.25V5.375q5.167 1.167 8.417 5.229 3.25 4.063 3.25 9.354 0 2.167-.584 4.209-.583 2.041-1.75 3.833Zm-5.583-5.583-3.75-3.75V13.25q1.958.917 3.063 2.75 1.104 1.833 1.104 4 0 .625-.104 1.229-.105.604-.313 1.188Zm-7.083-7.084L15.458 11l4.334-4.333Zm-2.75 11.25v-5.458l-3.334-3.333H7.583v4.416h5.084Zm-1.667-7.125Z"/></svg>');
		} else {
			if ($('#footerVolumeIcon').find('.volumeZero').length == 1) {
				$('#footerVolumeIcon').html('<svg xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="M23.333 34.542v-2.875q3.959-1.125 6.417-4.355 2.458-3.229 2.458-7.354t-2.458-7.375q-2.458-3.25-6.417-4.333V5.375q5.167 1.167 8.417 5.229Q35 14.667 35 19.958q0 5.292-3.25 9.354-3.25 4.063-8.417 5.23ZM5 25V15h6.667L20 6.667v26.666L11.667 25Zm17.792 1.875V13.042q2.166.791 3.437 2.708Q27.5 17.667 27.5 20q0 2.292-1.292 4.208-1.291 1.917-3.416 2.667Zm-5.584-13.292-4.333 4.209H7.792v4.416h5.083l4.333 4.25Zm-4 6.417Z"/></svg>');
			}
		}
	}
}

function toggleMute() {
	(db.app.debug)?console.log('f:{toggleMute}'):'';

	if (db.settings.mute) {
		db.settings.mute = false;
		document.getElementById('mainPlayer').volume = db.settings.volume/100;
		$('#volumeTrack').css('background-size', db.settings.volume+'% 100%');
		$('#footerVolumeCurrent').text(db.settings.volume);
		document.getElementById('volumeTrack').value = db.settings.volume;
		if (db.settings.volume!=0) {
			$('#footerVolumeIcon').html('<svg xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="M23.333 34.542v-2.875q3.959-1.125 6.417-4.355 2.458-3.229 2.458-7.354t-2.458-7.375q-2.458-3.25-6.417-4.333V5.375q5.167 1.167 8.417 5.229Q35 14.667 35 19.958q0 5.292-3.25 9.354-3.25 4.063-8.417 5.23ZM5 25V15h6.667L20 6.667v26.666L11.667 25Zm17.792 1.875V13.042q2.166.791 3.437 2.708Q27.5 17.667 27.5 20q0 2.292-1.292 4.208-1.291 1.917-3.416 2.667Zm-5.584-13.292-4.333 4.209H7.792v4.416h5.083l4.333 4.25Zm-4 6.417Z"/></svg>');
		} else {
			$('#footerVolumeIcon').html('<svg class="volumeZero" xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="m33.583 37.667-5.333-5.334q-1.125.75-2.417 1.313-1.291.562-2.708.896v-2.875q.833-.25 1.625-.563.792-.312 1.5-.771l-6.458-6.458v9.458L11.458 25H4.792V15h6.125L2.125 6.208l2-1.958 31.417 31.417ZM32.458 28l-2-2q.792-1.375 1.188-2.896.396-1.521.396-3.146 0-4.166-2.438-7.458-2.437-3.292-6.479-4.25V5.375q5.167 1.167 8.417 5.229 3.25 4.063 3.25 9.354 0 2.167-.584 4.209-.583 2.041-1.75 3.833Zm-5.583-5.583-3.75-3.75V13.25q1.958.917 3.063 2.75 1.104 1.833 1.104 4 0 .625-.104 1.229-.105.604-.313 1.188Zm-7.083-7.084L15.458 11l4.334-4.333Zm-2.75 11.25v-5.458l-3.334-3.333H7.583v4.416h5.084Zm-1.667-7.125Z"/></svg>');
		}
	} else {
		db.settings.mute = true;
		document.getElementById('mainPlayer').volume = 0;
		$('#volumeTrack').css('background-size','0% 100%');
		$('#footerVolumeCurrent').text('0');
		document.getElementById('volumeTrack').value = 0;
		$('#footerVolumeIcon').html('<svg class="volumeZero" xmlns="http://www.w3.org/2000/svg" height="40" width="40"><path d="m33.583 37.667-5.333-5.334q-1.125.75-2.417 1.313-1.291.562-2.708.896v-2.875q.833-.25 1.625-.563.792-.312 1.5-.771l-6.458-6.458v9.458L11.458 25H4.792V15h6.125L2.125 6.208l2-1.958 31.417 31.417ZM32.458 28l-2-2q.792-1.375 1.188-2.896.396-1.521.396-3.146 0-4.166-2.438-7.458-2.437-3.292-6.479-4.25V5.375q5.167 1.167 8.417 5.229 3.25 4.063 3.25 9.354 0 2.167-.584 4.209-.583 2.041-1.75 3.833Zm-5.583-5.583-3.75-3.75V13.25q1.958.917 3.063 2.75 1.104 1.833 1.104 4 0 .625-.104 1.229-.105.604-.313 1.188Zm-7.083-7.084L15.458 11l4.334-4.333Zm-2.75 11.25v-5.458l-3.334-3.333H7.583v4.416h5.084Zm-1.667-7.125Z"/></svg>');
	}
	localStorage.setItem(storageName,JSON.stringify(db));
}

function updateTopButtons(origin,action) {
	(db.app.debug)?console.log('f:{updateTopButtons('+origin+','+action+')}'):'';

	if (origin == 'all') {
		if (action=='play') {
			$('.btnPlay').css('display','flex');$('.btnPause').hide();$('.btnContinue').hide();
			$('#btnPlayAllSongs').hide();$('#btnPauseAllSongs').css('display','flex');$('#btnContinueAllSongs').hide();
		} else if (action=='pause') {
			$('#btnPlayAllSongs').hide();$('#btnPauseAllSongs').hide();$('#btnContinueAllSongs').css('display','flex');
		} else if (action=='continue') {
			$('#btnPlayAllSongs').hide();$('#btnPauseAllSongs').css('display','flex');$('#btnContinueAllSongs').hide();
		} else {
			$('.btnPlay').css('display','flex');$('.btnPause').hide();$('.btnContinue').hide();
		}
	} else {
		if (action=='play') {
			$('.btnPlay').css('display','flex');$('.btnPause').hide();$('.btnContinue').hide();
			$('#btnPlayPlaylist').hide();$('#btnPausePlaylist').css('display','flex');$('#btnContinuePlaylist').hide();
		} else if (action=='pause') {
			$('#btnPlayPlaylist').hide();$('#btnPausePlaylist').hide();$('#btnContinuePlaylist').css('display','flex');
		} else if (action=='continue') {
			$('#btnPlayPlaylist').hide();$('#btnPausePlaylist').css('display','flex');$('#btnContinuePlaylist').hide();
		} else {
			$('.btnPlay').css('display','flex');$('.btnPause').hide();$('.btnContinue').hide();
		}
	}

	// footer controls
	if (action=='play') {
		$('#footerControlPlay').hide();$('#footerControlPause').show();
	} else if (action=='pause') {
		$('#footerControlPlay').show();$('#footerControlPause').hide();
	} else if (action=='continue') {
		$('#footerControlPlay').hide();$('#footerControlPause').show();
	}
}

function downloadData(filename, text) {
	(db.app.debug)?console.log('f:{downloadData("'+filename+'","'+text+'")}'):'';
	
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);

	element.style.display = 'none';
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);

	var ahora = new Date();
	$('#lastDownload p').text('última copia: '+ahora.toLocaleDateString());
}

function importDataFromFile(element,redirect=false) {
	(db.app.debug)?console.log('f:{importDataFromFile}'):'';

	const reader = new FileReader();
	reader.onload = function() {
		console.log(event);
		console.log(event.target.result);

		if (isJson(event.target.result)) {
			var parsed = JSON.parse(event.target.result);
			(db.app.debug)?console.log(parsed):'';
			if (parsed.app!=undefined && parsed.settings!=undefined && parsed.songs!=undefined && parsed.playlists!=undefined) {
				if (parsed.app.version!=undefined && parsed.app.name!=undefined && parsed.app.debug!=undefined && parsed.app.lastUpdate!=undefined) {
					restoreOldData = JSON.parse(localStorage.getItem(storageName));
					
					if (parsed.app.version==app.version) {
						(db.app.debug)?console.log('restoring same version data'):'';
						db = parsed;
					} else {
						// #2004 importErr4 - The imported data is from another version of the app
						errorReporting(lang[codLang].errors.data.importErr4);
						console.log('restoring data from a diferent version');
						upgradeVersion(parsed);
					}
					if (redirect=='home') {
						showHome();
					}
					endSong();
					endPlaylist();
					$('#startup').css('display','none');
					localStorage.setItem(storageName,JSON.stringify(db));
				} else {
					// #2003 importErr3 - The import file doesn't have the correct format
					errorReporting(lang[codLang].errors.data.importErr3);
				}
			} else {
				// #2002 importErr2 - The import file doesn't have the correct format
				errorReporting(lang[codLang].errors.data.importErr2);
			}
		} else {
			// #2001 importErr1 - The import file doesn't have the correct format
			errorReporting(lang[codLang].errors.data.importErr1);
		}
	};
	reader.readAsText(document.getElementById(element).files[0]);
}

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function toggleShuffle() {
	(db.app.debug)?console.log('f:{toggleShuffle}'):'';
	if (db.settings.shuffle) {
		db.settings.shuffle = false;
		$('.btnShuffle').removeClass('btnShuffleAllSongsActive');
	} else {
		db.settings.shuffle = true;
		$('.btnShuffle').addClass('btnShuffleAllSongsActive');
	}
	localStorage.setItem(storageName,JSON.stringify(db));
}

function errorReporting(data,replace=false) { // shows an error on screen to the user
	if (typeof data === 'object') {
		(db.app.debug)?console.log('f:{errorReporting('+data.code+' -> '+data.message+')}'):'';
	} else {
		(db.app.debug)?console.log('f:{errorReporting('+data+')}'):'';
	}

	var html = '';
	var code = getRandomCode(5);
	html += '<div class="errorReportingBox" id="errorReportingBox'+code+'">';

	var msg;
	if (typeof data === 'object') {
		if (replace!=false) {
			msg = data.message.replace('%%',replace);
		} else {
			msg = data.message;
		}
		html += '<p class="errorReportCode">'+data.code+'</p>';
		console.log('ERROR '+data.code+': '+msg);
	} else {
		if (replace!=false) {
			msg = data.replace('%%',replace);
		} else {
			msg = data;
		}
		console.log('ERROR: '+msg);
	}

	html += '<p class="errorReportTxt">'+msg+'</p>';
	html += '</div>';

	$('#errorReporting').show();
	$('#errorReporting').append(html);
	$('#errorReportingBox'+code).css('visibility','visible');
	
	setTimeout(function() {
		$('#errorReportingBox'+code).remove();
		$.when($('#errorReportingBox'+code).remove()).then(function() {
			if ($('#errorReporting').children().length==0) {
				$('#errorReporting').hide();
			}
		});
	},5000);
}

function loadSuggests(num) {
	(db.app.debug)?console.log('f:{loadSuggests('+num+')}'):'';
	var songsLength = Object.keys(db.songs); // ERROR: no excluye las canciones no disponibles
	var numberSuggested = num;
	var showedSongs = [];
	var html = '';
	var val;
	var countIteration = 0;
	var songsAvailable = songsLength.length-Object.keys(db.avoided).length;

	for (i=0; i<numberSuggested; i++) { // se repite por cada cuadrante
		//console.log('i: '+i);
		var loop = true;

		var avoided = [];
		for (j in db.avoided) {
			avoided.push(j);
		}
		
		if (countIteration<songsAvailable) {
			if (showedSongs.length<songsAvailable) { // si los canales de la BD son más que los mostrados
				//console.log('showed: '+showedSongs.length + ', channels: ' + channelsLength.length);
				while (loop==true) { // si el valor elegido ya ha sido mostrado se repite la selección
					val = pickRandomProperty(db.songs);
					if (!showedSongs.includes(val) && !avoided.includes(val)) { // si la canción escogida no ha sido escogida antes ni está evitada se pasa a elegir el siguiente cuadrante
						loop = false;
						showedSongs.push(val);
					}
					//console.log('val: '+val+', disabled: '+channels[val].disabled+', loop: '+loop);
				}
			}

			countIteration++;

			var minutes = Math.floor(db.songs[val].duration/60);
			var seconds = db.songs[val].duration - (minutes*60);
			var origin = 'all';

			html += '<div class="homeSuggestItem" onclick="playSongItem(\''+origin+'\',\''+val+'\');showSongs()">';
				html += '<img src="'+db.settings.coverPath+'/'+db.songs[val].image+'" />';
				html += '<div class="homeSuggestText">';
					html += '<p class="homeSuggestTitle">'+db.songs[val].title+'</p>';
					html += '<p class="homeSuggestArtist">'+db.songs[val].artist+'</p>';
					html += '<p class="homeSuggestDuration">'+minutes+':'+twoDigits(seconds)+'</p>';
				html += '</div>';
			html += '</div>';
		}
	}
	$('#tabHomeSuggestedSection').html('');
	$('#tabHomeSuggestedSection').append(html);
}

function notPlayedSongs() {
	(db.app.debug)?console.log('f:{notPlayedSongs}'):'';

	var allSongsTime = {};
	var zeroPlayedCount = [];
	let notPlayedElements = [];
	let currentDate = new Date();

	for (i in db.songs) {
		if (db.songs[i].lastPlayed == false) {
			zeroPlayedCount.push(i);
		} else {
			allSongsTime[i] = db.songs[i].lastPlayed;
		}
	}
	
	let sortable = [];
	for (var song in allSongsTime) {
	    sortable.push([song, allSongsTime[song]]);
	}

	sortable.sort(function(a, b) {
	    return a[1] - b[1];
	});
	//console.log(sortable);

	var recentDate = new Date(sortable[Object.keys(sortable).length-1][1]);
	var oldestDate  = new Date(sortable[0][1]);
	var secondOldestDate = new Date(sortable[1][1]);

	let numberReallyOld = 0;

	var secOldDifference_In_Time = currentDate.getTime() - secondOldestDate.getTime();
    var secOldDifference_In_Days = secOldDifference_In_Time / (1000 * 3600 * 24);
    //console.log(secOldDifference_In_Days);

	var oldDifference_In_Time = currentDate.getTime() - oldestDate.getTime();
    var oldDifference_In_Days = oldDifference_In_Time / (1000 * 3600 * 24);
    //console.log(oldDifference_In_Days);

    if (secOldDifference_In_Days>30) {
    	numberReallyOld++;
    }
    if (oldDifference_In_Days>30) {
    	numberReallyOld++;
    }

	/*console.log('mostRecentDate '+recentDate.getTime());
	console.log(recentDate);
	console.log('secondOldestDate '+secondOldestDate.getTime());
	console.log(secondOldestDate);
	console.log('oldestDate '+oldestDate.getTime());
	console.log(oldestDate);
	console.log('zeroPlayedCount');
	console.log(zeroPlayedCount.length);*/
	
	if (zeroPlayedCount.length==1) {
		var rand = zeroPlayedCount[(Math.random() * zeroPlayedCount.length) | 0];
		console.log(db.songs[rand].title+' - '+db.songs[rand].artist);
		notPlayedElements.push(rand);
	} else if (zeroPlayedCount.length>1) {
		let random = zeroPlayedCount.sort(() => .5 - Math.random()).slice(0,2);
		console.log(random);
		notPlayedElements = random;
	}

	if (zeroPlayedCount.length==1) {
		if (numberReallyOld>0) {
			notPlayedElements.push(sortable[0][0]);
		}
	} else if (zeroPlayedCount.length==0) {
		if (numberReallyOld>0) {
			notPlayedElements.push(sortable[0][0]);
			if (numberReallyOld>1) {
				notPlayedElements.push(sortable[1][0]);
			}
		}
	}

	let html = '';
	for (j in notPlayedElements) {
		html += '<div class="homeNotPlayedItem" onclick="playSongItem(\'all\',\''+notPlayedElements[j]+'\');showSongs()">';
			html += '<img src="'+db.settings.coverPath+db.songs[notPlayedElements[j]].image+'">';
			html += '<div class="homeNotPlayedText">';
				html += '<p class="homeNotPlayedTitle">'+db.songs[notPlayedElements[j]].title+'</p>';
				html += '<p class="homeNotPlayedArtist">'+db.songs[notPlayedElements[j]].artist+'</p>';
				html += '<p class="homeNotPlayedLastPlayed">'+relativeDate(db.songs[notPlayedElements[j]].lastPlayed,'relative')+'</p>';
				html += '<p class="homeNotPlayedDuration">'+formatSeconds(db.songs[notPlayedElements[j]].duration)+'</p>';
			html += '</div>';
		html += '</div>';
	}

	$('#homeNotPlayedCenter').html(html);

	if (zeroPlayedCount.length==0 && numberReallyOld==0) {
		$('#tabHomeNotPlayedSongs').hide();
	} else {
		$('#tabHomeNotPlayedSongs').show();
	}
}

function mostPlayedList() {
	(db.app.debug)?console.log('f:{mostPlayedList}'):'';

	var arraySongs = [];
	for (i in db.songs) {
		arraySongs.push({ 'id': i, 'timesPlayed': db.songs[i].timesPlayed });
	}

	arraySongs.sort(compareObjects);

	var htmlMostPlayed = '';
	var countMostPlayed = 1;
	for (j in arraySongs) {
		if (countMostPlayed<=15) {
			if (countMostPlayed<=5) {
				htmlMostPlayed += '<div class="homeMostPlayedItem" id="mostPlayedItem-'+arraySongs[j].id+'">';
			} else {
				htmlMostPlayed += '<div class="homeMostPlayedItem homeMostPlayedItemMore" id="mostPlayedItem-'+arraySongs[j].id+'">';
			}
				htmlMostPlayed += '<p class="mostPlayedNumber">'+countMostPlayed+'</p>';
				htmlMostPlayed += '<p class="mostPlayedTitle">'+db.songs[arraySongs[j].id].title+'</p>';
				htmlMostPlayed += '<p class="mostPlayedArtist">'+db.songs[arraySongs[j].id].artist+'</p>';
				htmlMostPlayed += '<p class="mostPlayedTimesPlayed">'+db.songs[arraySongs[j].id].timesPlayed+' '+lang[codLang].homePage.timesPlayed+'</p>';
			htmlMostPlayed += '</div>';
			countMostPlayed++;
		}
	}

	if (arraySongs.length==0) {
		htmlMostPlayed += '<div class="homeMostPlayedItem" id="mostPlayedItemNoResult">';
			htmlMostPlayed += '<p>'+lang[codLang].mySongs.noSongs+'</p>';
		htmlMostPlayed += '</div>';
	}

	$('#homeMostPlayedList').html(htmlMostPlayed);
}

function compareObjects( b, a ) {
  if ( a.timesPlayed < b.timesPlayed ) {
    return -1;
  }
  if ( a.timesPlayed > b.timesPlayed ) {
    return 1;
  }
  return 0;
}

function resetTimesPlayed() {
	(db.app.debug)?console.log('f:{resetTimesPlayed}'):'';

	for (i in db.songs) {
		db.songs[i].timesPlayed = 0;
	}
	localStorage.setItem(storageName,JSON.stringify(db));
}

function searchSongs(origin,q) {
	(db.app.debug)?console.log('f:{searchSongs('+origin+','+q+')}'):'';

	if (q.length<3) {	// si el texto introducido es menor de 3 caracteres no se busca
		if (origin=='all') {
			showSongs();
		} else {
			showPlaylist(currentPlaylist);
		}
	} else {
		q = q.toLowerCase();	// simplificamos el texto introducido para encontrar más coincidencias
		var simple = removeDiacritics(q);
		simple = simple.replace(/[^0-9a-z]/gi, '');
		console.log(simple);

		var results = 0;
		var htmlSearch = '';
		var songsListSearch = [];

		if (origin=='all') {	// establecemos el pool de canciones que se va a analizar según donde estemos buscando (todas las canciones o un playlist)
			var songsArray = db.songs;
		} else {
			var songsArray = {};
			for (i in db.playlists[origin].songs) {
				songsArray[db.playlists[origin].songs[i]] = db.songs[db.playlists[origin].songs[i]];
			}
		}

		console.log(songsArray);

		for (i in songsArray) {
			if (songsArray[i].title.toLowerCase().includes(q) || removeDiacritics(songsArray[i].title.toLowerCase()).includes(simple)) {
				console.log(songsArray[i].title+' incluye el término de búsqueda en title');
				results++;
				songsListSearch.push(i);
			} else if (songsArray[i].artist.toLowerCase().includes(q) || songsArray[i].artist.toLowerCase().includes(simple)) {
				console.log(songsArray[i].title+' incluye el término de búsqueda en artist');
				results++;
				songsListSearch.push(i);
			} else if (songsArray[i].album.toLowerCase().includes(q) || songsArray[i].album.toLowerCase().includes(simple)) {
				console.log(songsArray[i].title+' incluye el término de búsqueda en album');
				results++;
				songsListSearch.push(i);
			} else if (songsArray[i].genre.toLowerCase().includes(q) || songsArray[i].genre.toLowerCase().includes(simple)) {
				console.log(songsArray[i].title+' incluye el término de búsqueda en genre');
				results++;
				songsListSearch.push(i);
			}
		}

		console.log(songsListSearch);

		if (results>0) {
			var count = 1;
			for (i in songsListSearch) {
				var fecha = new Date(db.songs[songsListSearch[i]].addedIn);
				var minutes = Math.floor(db.songs[songsListSearch[i]].duration/60);
				var seconds = db.songs[songsListSearch[i]].duration - (minutes*60);
				if (player.playing.songId==songsListSearch[i]) {
					if (db.avoided[songsListSearch[i]]==undefined) {
						htmlSearch += '<div class="allSongsItem allSongsItemPlaying" id="allSongsItem-'+db.songs[songsListSearch[i]]+'">';
					} else {
						htmlSearch += '<div class="allSongsItem allSongsItemAvoided allSongsItemPlaying" id="allSongsItem-'+db.songs[songsListSearch[i]]+'">';
					}
				} else {
					if (db.avoided[songsListSearch[i]]==undefined) {
						htmlSearch += '<div class="allSongsItem" id="allSongsItem-'+songsListSearch[i]+'">';
					} else {
						htmlSearch += '<div class="allSongsItem allSongsItemAvoided" id="allSongsItem-'+songsListSearch[i]+'">';
					}
				}
				if (db.avoided[songsListSearch[i]]==undefined) {
					htmlSearch += '<div class="songsRow" id="songsRowOrder"><p>'+count+'</p></div>';
				} else {
					htmlSearch += '<div class="songsRow" id="songsRowOrder">';
						htmlSearch += '<svg class="iconSongAvoided" id="Capa_1" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><title>Canción evitada</title><path d="M24,44a19.29,19.29,0,0,1-7.8-1.58A19.91,19.91,0,0,1,5.58,31.8a20.1,20.1,0,0,1,0-15.6A20,20,0,0,1,16.2,5.58a20.1,20.1,0,0,1,15.6,0,20.42,20.42,0,0,1,6.35,4.28,20.05,20.05,0,0,1,4.27,6.35A19.29,19.29,0,0,1,44,24a19.29,19.29,0,0,1-1.58,7.8A19.91,19.91,0,0,1,31.8,42.42,19.29,19.29,0,0,1,24,44Zm0-3a16.41,16.41,0,0,0,12-5,16.41,16.41,0,0,0,5-12,16.55,16.55,0,0,0-1-5.85,17.56,17.56,0,0,0-3-5.1L13.05,37a15.9,15.9,0,0,0,5.08,3A16.91,16.91,0,0,0,24,41ZM11.05,35,35,11.05a17.05,17.05,0,0,0-5.1-3A16.55,16.55,0,0,0,24,7,16.41,16.41,0,0,0,12,12,16.41,16.41,0,0,0,7,24a16.19,16.19,0,0,0,1.1,5.88A18.52,18.52,0,0,0,11.05,35Z" transform="translate(-4 -4)"/></svg>';
					htmlSearch += '</div>';
				}
					htmlSearch += '<div class="songsRow" id="songsRowImage"><img src="'+db.settings.coverPath+'/'+db.songs[songsListSearch[i]].image+'" /></div>';
					htmlSearch += '<div class="songsRow" id="songsRowTitle"><p>'+db.songs[songsListSearch[i]].title+'</p></div>';
					htmlSearch += '<div class="songsRow" id="songsRowArtist"><p>'+db.songs[songsListSearch[i]].artist+'</p></div>';
					htmlSearch += '<div class="songsRow" id="songsRowAlbum"><p>'+db.songs[songsListSearch[i]].album+'</p></div>';
					htmlSearch += '<div class="songsRow" id="songsRowGenre"><p>'+db.songs[songsListSearch[i]].genre+'</p></div>';
					htmlSearch += '<div class="songsRow" id="songsRowDuration"><p>'+minutes+':'+twoDigits(seconds)+'</p></div>';
					if (origin=='all') {
						htmlSearch += '<div class="songsRow" id="songsRowAddedIn"><p>'+twoDigits(fecha.getDate())+'/'+twoDigits(fecha.getMonth()+1)+'/'+fecha.getFullYear()+'</p></div>';
					}
					htmlSearch += '<div class="songsRow" id="songsRowActions"><p></p></div>';
					htmlSearch += '<input class="songsUrl" type="hidden" value="'+db.songs[songsListSearch[i]].url+'" />';
					htmlSearch += '<input class="songsOrigin" type="hidden" value="all" />'; // almacena información sobre la lista donde está contenida
				htmlSearch += '</div>';
				//totalDuration += db.songs[i].duration;
				count++;
			}
		} else {
			htmlSearch += '<div class="allSongsItem allSongsNoResults">';
				htmlSearch += '<p>'+lang[codLang].mySongs.noSongs+'</p>';
			htmlSearch += '</div>';
		}

		if (origin=='all') {
			$('#listAllSongs').html(htmlSearch);

			$('.allSongsItem').on('click',function() {
				if (!$(this).hasClass('allSongsNoResults')) {
					playSongItem($(this).find('.songsOrigin').val(),$(this).attr('id').substring(13));
				}
			});
			$('#btnPlayAllSongs').on('click',function() {
				if (db.settings.shuffle) {
					setSongQueue('all',false,true);
				} else {
					setSongQueue('all',false,false);
				}
				updateTopButtons('all','play');
			});
		} else {
			$('#listAllPlaylistSongs').html(htmlSearch);
		}
		
	}
}

function setDarkModeState(change=false) {
	(db.app.debug)?console.log('f:{setDarkModeState('+change+')}'):'';

	if (change) { // si se invoca la función para cambiar el valor de darkmode
		if (change == 'enable') {
			db.settings.darkmode = true;
			$('#container').addClass('darkContainer');
			$('#dialogs').addClass('darkDialogs');
		} else if (change == 'disable') {
			db.settings.darkmode = false;
			$('#container').removeClass('darkContainer');
			$('#dialogs').removeClass('darkDialogs');
		}
	} else { // si se invoca al cargar la página para establecer el valor actual
		if (db.settings.darkmode == true) {
			$('#container').addClass('darkContainer');
			$('#dialogs').addClass('darkDialogs');
		} else if (db.settings.darkmode == false) {
			$('#container').removeClass('darkContainer');
			$('#dialogs').removeClass('darkDialogs');
		}
	}
}

function upgradeVersion(data) { // still in development
	(db.app.debug)?console.log('f:{upgradeVersion()}'):'';

	if (data.app==undefined) {
		data.app = app;
	}
	if (data.songs==undefined) {
		data.songs = {};
	} else {
		for (i in data.songs) {
			if (data.songs[i].title==undefined) {
				data.songs[i].title = '-';
			}
			if (data.songs[i].album==undefined) {
				data.songs[i].album = '-';
			}
			if (data.songs[i].artist==undefined) {
				data.songs[i].artist = '-';
			}
			if (data.songs[i].genre==undefined) {
				data.songs[i].genre = '-';
			}
			if (data.songs[i].duration==undefined) {
				data.songs[i].duration = 0;
			}
			if (data.songs[i].image==undefined) {
				data.songs[i].image = '-';
			}
			if (data.songs[i].url==undefined) {
				data.songs[i].url = '-';
			}
			if (data.songs[i].published==undefined) {
				data.songs[i].published = '-';
			}
			if (data.songs[i].addedIn==undefined) {
				data.songs[i].addedIn = '-';
			}
			if (data.songs[i].timesPlayed==undefined) {
				data.songs[i].timesPlayed = 0;
			}
			if (data.songs[i].lastPlayed==undefined) {
				data.songs[i].lastPlayed = false;
			}
		}
	}
	if (data.playlists==undefined) {
		data.playlists = {};
	}
	if (data.settings==undefined) {
		data.settings = settings;
	}
	if (data.avoided==undefined) {
		data.avoided = {};
	}

	db = data; // restoring the data upgraded to the current version
}

function activeTimerTick() {
	activetime++;
	//console.log('active time: '+activetime);
	if (currentTab=='tabHome') {
		$('#homeActiveTime').text(activetime+' segundos');
	}
}

function startActiveTimer() {
	(db.app.debug)?console.log('f:{startActiveTimer()}'):'';
	activeTimerPlaying = true;
	activetimeInterval = setInterval(function() { activeTimerTick() },1000);
}

function stopActiveTimer() {
	(db.app.debug)?console.log('f:{stopActiveTimer()}'):'';
	activeTimerPlaying = false;
	clearInterval(activetimeInterval);
}

/* ---------------- add elements to the database ---------------- */

function showAddSongDialog() {
	(db.app.debug)?console.log('f:{showAddSongDialog}'):'';

	$('.tab').hide();
	$('#tabAddSong').show();
	setActiveTab('addSong');
	$('#addSongInputTitle').focus();
}

function addSongValidation() {
	var title = $('#addSongInputTitle').val();
	var artist = $('#addSongInputArtist').val();
	var album = $('#addSongInputAlbum').val();
	var genre = $('#addSongInputGenre').val();
	var duration = 0;
	var published = $('#addSongInputPublished').val();
	var image = $('#addSongInputImage').val();
	var url = $('#addSongInputUrl').val();

	var coincidenceUrl = false;
	for (i in db.songs) {
		if (db.songs[i].url == url) {
			coincidenceUrl = true;
		}
	}

	var formatsImage = ['jpg','jpeg','png','gif','svg','bmp','tiff','eps','webp'];
	var formatsUrl = ['mp3','ogg','webm','wav','m4a','m4b'];

	if (title!='' && artist!='' && image!='' && url!='') {
		if (formatsImage.includes(image.substring(image.lastIndexOf('.')+1)) && formatsUrl.includes(url.substring(url.lastIndexOf('.')+1))) {
			if (!coincidenceUrl) {
				addSong(title,artist,album,genre,duration,published,image,url);
			} else {
				// #3003 addErr3 - the audio file was already used in another added song
				errorReporting(lang[codLang].errors.songs.addErr3);
			}
		} else {
			// #3002 addErr2 - the image or audio format is wrong
			errorReporting(lang[codLang].errors.songs.addErr2);
		}	
	} else {
		// #3001 addErr1 - Mandatory song attributes remain empty
		errorReporting(lang[codLang].errors.songs.addErr1);
	}
}

function addSong(title,artist,album,genre,duration,published,image,url) {
	(db.app.debug)?console.log('f:{addSong('+title+')}'):'';

	var ahora = new Date();
	var id = getRandomId(22);

	db.songs[id] = {'title':title,'artist':artist,'album':album,'genre':genre,'duration':duration,'published':published,'image':image,'url':url,'addedIn':ahora.getTime(),'timesPlayed':0,'lastPlayed':false};

	getDuration(db.settings.audioPath+'/'+url, id, function(length) {
		if (length=='error') {
			// #3004 addErr4 - an error occurred reading the added audio file
			errorReporting(lang[codLang].errors.songs.addErr4);
		} else {
			db.songs[id].duration = Math.floor(length);
		    console.log(db.songs[id]);
		    localStorage.setItem(storageName,JSON.stringify(db));
		    showSongs();

		    $('#addSongInputTitle').val('');$('#addSongInputArtist').val('');$('#addSongInputAlbum').val('');
			$('#addSongInputGenre').val('');$('#addSongInputPublished').val('');$('#addSongInputImage').val('');$('#addSongInputUrl').val('');

			// if the playlist All Songs is playing right now the newly added song will be at the end of queue
			if (player.queue.origin == 'all') {
				addSongtoQueue('all',id);
			}
		}
	});
}

function getDuration(src, id, cb) {
	(db.app.debug)?console.log('f:{getDuration}'):'';
	try {
		var audio = new Audio();
		audio.onerror = function(){
			// #3005 addErr5 - the added audio can't be played
			errorReporting(lang[codLang].errors.songs.addErr5);
		};

	    $(audio).on("loadedmetadata", function(){
	        cb(audio.duration);
	    });
	    audio.src = src;
	} catch {
		cb('error');
	}
}

function addPlaylistConfirmation(songId=false) {
	(db.app.debug)?console.log('f:{addPlaylistConfirmation('+songId+')}'):'';

	if (songId!=false) {
		$('#dialogNewPlaylistSong').html(lang[codLang].newPlaylist.songAdded.replace('%%','<i>'+db.songs[songId].title+'</i>'));
		$('#dialogNewPlSongId').val(songId);
	} else {
		$('#dialogNewPlaylistSong').html('');
		$('#dialogNewPlSongId').val('false');
	}
	$('#dialogs').css('display','flex');
	$('.dialog').hide();
	$('#dialogCreatePlaylist').show();
	$('#dialogNewPlaylistName').focus();
}

function addPlaylist(name,image,songId) {
	(db.app.debug)?console.log('f:{addPlaylist('+name+')}'):'';

	if (name!='' && name!=undefined) {
		var ahora = new Date();
		var id = getRandomId(15);

		db.playlists[id] = {'name':name,'image':image,'created':ahora.getTime(),'songs': []};

		if (songId!='false') {
			addSongToPlaylist(songId,id);
		}
		localStorage.setItem(storageName,JSON.stringify(db));

		$('#dialogs').hide();
		$('.dialog').hide();
		showNavPlaylists();
		showPlaylist(id);
	} else {
		// #4001 addErr1 - Introduce a name por the new playlist
		errorReporting(lang[codLang].errors.playlists.addErr1);
		$('#dialogNewPlaylistName').focus();
	}
}

function addSongToPlaylist(songId,playlistId) {
	(db.app.debug)?console.log('f:{addSongToPlaylist('+songId+','+playlistId+')}'):'';

	if (!db.playlists[playlistId].songs.includes(songId)) {
		db.playlists[playlistId].songs.push(songId);
		localStorage.setItem(storageName,JSON.stringify(db));

		if (player.queue.origin == playlistId) {
			addSongtoQueue(playlistId,songId);
		}
	} else {
		// #4301 addSongErr1 - This song is already in this playlist
		errorReporting(lang[codLang].errors.playlists.addSongErr1);
	}
}

/* ---------------- edit elements of the database ---------------- */

function showEditSongDialog(id) {
	(db.app.debug)?console.log('f:{showEditSongDialog('+id+')}'):'';

	$('#tabEditSong #tabTopInfo').text((lang[codLang].editSong.subtitle).replace('%%',db.songs[id].title).replace('%%',db.songs[id].artist));
	$('#editSongId').val(id);
	$('#editSongInputTitle').val(db.songs[id].title);
	$('#editSongInputArtist').val(db.songs[id].artist);
	$('#editSongInputAlbum').val(db.songs[id].album);
	$('#editSongDuration').val(db.songs[id].duration);
	$('#editSongInputGenre').val(db.songs[id].genre);
	$('#editSongInputPublished').val(db.songs[id].published);
	$('#editSongAddedIn').val(db.songs[id].addedIn);
	$('#editSongInputImage').val(db.songs[id].image);
	$('#editSongInputUrl').val(db.songs[id].url);
	$('#editSongTimesPlayed').val(db.songs[id].timesPlayed);
	$('#editSongLastPlayed').val(db.songs[id].lastPlayed);
	$('#editSongPrevTab').val(currentTab);

	$('.tab').hide();
	$('#tabEditSong').show();
	setActiveTab('editSong');
	$('#editSongInputTitle').focus();
}

function editSongValidation() {
	var id = $('#editSongId').val();
	var title = $('#editSongInputTitle').val();
	var artist = $('#editSongInputArtist').val();
	var album = $('#editSongInputAlbum').val();
	var genre = $('#editSongInputGenre').val();
	var duration = parseInt($('#editSongDuration').val());
	var published = $('#editSongInputPublished').val();
	var addedIn = parseInt($('#editSongAddedIn').val());
	var image = $('#editSongInputImage').val();
	var url = $('#editSongInputUrl').val();
	var timesPlayed = parseInt($('#editSongTimesPlayed').val());
	if ($('#editSongLastPlayed').val() == 'false') {
		var lastPlayed = false;
	} else {
		var lastPlayed = $('#editSongLastPlayed').val();
	}
	var previousTab = $('#editSongPrevTab').val();

	console.log(addedIn);

	if (title!='' && artist!='' && image!='' && url!='' && addedIn!='' && id!='') {
		editSong(id,title,artist,album,genre,duration,published,addedIn,image,url,timesPlayed,lastPlayed,previousTab);
		$('#editSongId').val('');$('#addSongInputTitle').val('');$('#addSongInputArtist').val('');$('#addSongInputAlbum').val('');
		$('#addSongInputGenre').val('');$('#addSongInputPublished').val('');$('#editSongAddedIn').val('');$('#addSongInputImage').val('');$('#addSongInputUrl').val('');$('#editSongTimesPlayed').val('');$('#editSongLastPlayed').val('');
	} else {
		// #3101 editErr1 - Mandatory fields editing the song are missing
		errorReporting(lang[codLang].errors.songs.editErr1);
	}
}

function editSong(id,title,artist,album,genre,duration,published,addedIn,image,url,timesPlayed,lastPlayed,prevTab) {
	(db.app.debug)?console.log('f:{editSong('+title+')}'):'';

	db.songs[id] = {'title':title,'artist':artist,'album':album,'genre':genre,'duration':duration,'published':published,'image':image,'url':url,'addedIn':addedIn,'timesPlayed':timesPlayed,'lastPlayed':lastPlayed};

	localStorage.setItem(storageName,JSON.stringify(db));
	if (prevTab=='tabSongs') {
		showSongs();
	} else {
		showPlaylist(currentPlaylist);
	}
}

function renamePlaylistConfirmation(id) {
	(db.app.debug)?console.log('f:{renamePlaylistConfirmation('+id+')}'):'';

	$('#dialogRenamePlaylist .dialogRenamePlaylistText').html(lang[codLang].renamePlaylist.mainMessage.replace('%%','<i id="dialogRenamePlaylistName">'+db.playlists[id].name+'</i>'));
	$('#dialogRenamePlaylistNewName').val(db.playlists[id].name);
	$('#dialogRenamePlaylistId').val(id);

	$('#dialogs').css('display','flex');
	$('.dialog').hide();
	$('#dialogRenamePlaylist').show();
	$('#dialogRenamePlaylistNewName').focus();
}

function renamePlaylist(id) {
	(db.app.debug)?console.log('f:{renamePlaylist('+id+')}'):'';

	var newName = $('#dialogRenamePlaylistNewName').val();

	if (newName=='' || newName==undefined) {
		// #4101 renameErr1 - New playlist name is blank
		errorReporting(lang[codLang].errors.playlists.renameErr1);
		$('#dialogRenamePlaylistNewName').focus();
	} else {
		var newNameRepeated = false;
		for (i in db.playlists) {
			if (db.playlists[i].name == newName) {
				newNameRepeated = true;
			}
		}

		if (newName == db.playlists[id].name) {
			// #4102 renameErr2 - Same name again in changing playlist name
			errorReporting(lang[codLang].errors.playlists.renameErr2);
			$('#dialogRenamePlaylistNewName').focus();
		} else {
			if (newNameRepeated) {
				// #4103 renameErr3 - A playlist with this name already exists
				errorReporting(lang[codLang].errors.playlists.renameErr3);
				$('#dialogRenamePlaylistNewName').focus();
			} else {
				db.playlists[id].name = newName;
				if ($('#navOptPlaylistItem-'+id).hasClass('navOptActive')) {
					$('#playlistTopLeft .tabTopLeftTitle h2').html(newName);
				}
				$('#navOptPlaylistItem-'+id+' p').text(newName);

				localStorage.setItem(storageName,JSON.stringify(db));
				console.log('playlist renombrada a '+newName);

				$('#dialogs').hide();
				$('.dialog').hide();
			}
		}
	}
}

/* ---------------- delete elements of the database ---------------- */

function removePlaylistSong(playlistId,songId) {
	(db.app.debug)?console.log('f:{removePlaylistSong('+playlistId+','+songId+')}'):'';

	if (db.playlists[playlistId]!=undefined) {
		if (db.playlists[playlistId].songs.includes(songId)) {
			var index = db.playlists[playlistId].songs.indexOf(songId);
			if (index!==-1) {
				db.playlists[playlistId].songs.splice(index,1);
			}
			
			localStorage.setItem(storageName,JSON.stringify(db));
			showPlaylist(playlistId);
		} else {
			// #4304 addSongErr4 - This song doesn't exist in the playlist %%
			errorReporting(lang[codLang].errors.playlists.addSongErr4,db.playlists[playlistId].name);
		}
	} else {
		// #4303 addSongErr3 - This playlist does not exist
		errorReporting(lang[codLang].errors.playlists.addSongErr3);
	}
}

function deleteSongConfirmation(songId) {
	(db.app.debug)?console.log('f:{deleteSongConfirmation('+songId+')}'):'';

	$('#dialogDeleteSong .dialogDeleteSongText').html(lang[codLang].deleteSong.mainMessage.replace('%%','<i id="dialogDeleteSongName">'+db.songs[songId].title+'</i>'));
	//$('#dialogDeleteSongName').text(db.songs[songId].title);
	$('#dialogDeleteSongId').val(songId);
	var detectedPlaylists = [];
	for (i in db.playlists) {
		if (db.playlists[i].songs.includes(songId)) {
			detectedPlaylists.push(db.playlists[i].name);
		}
	}
	if (detectedPlaylists.length>0) {
		$('#dialogDeleteSongPlaylist').text(lang[codLang].deleteSong.relatedPlaylistsMsg.replace('%%',detectedPlaylists.join(', ')));
	} else {
		$('#dialogDeleteSongPlaylist').html(lang[codLang].deleteSong.noRelatedPlaylistsMsg);
	}

	$('#dialogs').css('display','flex');
	$('.dialog').hide();
	$('#dialogDeleteSong').show();
}

function deleteSong(songId) {
	(db.app.debug)?console.log('f:{deleteSong('+songId+')}'):'';

	if (songId!='' || songId!=undefined) {
		for (i in db.playlists) {
			if (db.playlists[i].songs.includes(songId)) {
				(db.app.debug)?console.log('canción detectada en playlist: '+db.playlists[i].name):'';
				var index = db.playlists[i].songs.indexOf(songId);
				if (index!==-1) {
					db.playlists[i].songs.splice(index,1);
				}
			}
		}

		if (player.playing.songId == songId) { // if the deleted song is currently playing it'll be skiped inmediately
			nextSong();
			player.queue.position -= 1;
		}

		for (j in player.queue.songs) {
			if (player.queue.songs[j] == songId) {
				player.queue.songs.splice(j,1);
			}
		}

		delete db.songs[songId];
		
		if (db.avoided[songId]!=undefined) { // if the deleted song is avoided it'll be removed
			delete db.avoided[songId];
		}

		localStorage.setItem(storageName,JSON.stringify(db));
		showSongs();
		updateAvoidedSongsList();

		$('#dialogs').hide();
		$('.dialog').hide();
	} else {
		// #3201 deleteErr1 - An error occurred trying to delete the song
		errorReporting(lang[codLang].errors.songs.deleteErr1);
	}
}

function deletePlaylistConfirmation(id) {
	(db.app.debug)?console.log('f:{deletePlaylistConfirmation('+id+')}'):'';

	$('#dialogDeletePlaylist .dialogDeletePlaylistText').html(lang[codLang].deletePlaylist.mainMessage.replace('%%','<i id="dialogDeletePlaylistName">'+db.playlists[id].name+'</i>'));
	$('#dialogDeletePlaylistName').text(db.playlists[id].name);
	$('#dialogDeletePlaylistId').val(id);

	$('#dialogs').css('display','flex');
	$('.dialog').hide();
	$('#dialogDeletePlaylist').show();
}

function deletePlaylist(id) {
	(db.app.debug)?console.log('f:{deletePlaylist('+id+')}'):'';

	if (id!='' || id!=undefined) {
		if (Object.keys(db.playlists).includes(id)) {
			var changeIdShown = false;
			if ($('#navOptPlaylistItem-'+id).hasClass('navOptActive')) {
				var length = Object.keys(db.playlists).length;
				if (length<=1) { // en caso que sea la ultima playlist que quede mostramos la lista de todas las canciones
					console.log('era la unica playlist que quedaba');
					changeIdShown = 'songs';
				} else if (Object.keys(db.playlists).indexOf(id) < length-1) { // en caso que quede ulguna playlist a continuación mostramos esa
					var nextPlId = Object.keys(db.playlists)[Object.keys(db.playlists).indexOf(id)+1];
					changeIdShown = nextPlId;
					console.log('quedan a continuación: '+nextPlId);
				} else {
					var firstPlId = Object.keys(db.playlists)[0];
					changeIdShown = firstPlId;
					console.log('mostramos la primera playlist: '+firstPlId);
				}
			} else {
				console.log('no está activa la ventana');
			}

			delete db.playlists[id];
			localStorage.setItem(storageName,JSON.stringify(db));

			showNavPlaylists();
			if (changeIdShown==false) {
			} else if (changeIdShown == 'songs') {
				showSongs();
			} else {
				showPlaylist(changeIdShown);
			}

			$('#dialogs').hide();
			$('.dialog').hide();
		} else {
			// #4202 deleteErr2 - The playlist you are trying to delete doesn't exist
			errorReporting(lang[codLang].errors.playlists.deleteErr2);
		}
	} else {
		// #4201 deleteErr1 - An error occurred trying to delete the playlist
		errorReporting(lang[codLang].errors.playlists.deleteErr1);
	}
}

function avoidSong(id) {
	(db.app.debug)?console.log('f:{avoidSong('+id+')}'):'';

	if (db.avoided[id] == undefined) {
		var fecha = new Date();
		var nuevaFecha = fecha.setDate(fecha.getDate()+15);

		var fechaFin = new Date(nuevaFecha);
		db.avoided[id] = fechaFin.getTime();
		if (currentTab=='tabSongs') { showSongs(); }
		else if (currentTab=='tabPlaylists') { showPlaylist(currentPlaylist); }

		localStorage.setItem(storageName,JSON.stringify(db));
		updateAvoidedSongsList();
	}
}

function unavoidSong(id) {
	(db.app.debug)?console.log('f:{unavoidSong('+id+')}'):'';

	if (db.avoided[id] != undefined) {
		delete db.avoided[id];
		console.log(db.avoided);
		if (currentTab=='tabSongs') { showSongs(); }
		else if (currentTab=='tabPlaylists') { showPlaylist(currentPlaylist); }

		localStorage.setItem(storageName,JSON.stringify(db));
		updateAvoidedSongsList();
	}
}

function updateAvoidedSongsList() {
	(db.app.debug)?console.log('f:{updateAvoidedSongsList()}'):'';

	for (i in db.avoided) {
		var fecha = new Date(db.avoided[i]);
		var ahora = new Date();

		if (fecha.getTime() < ahora.getTime()) {
			unavoidSong(i);
		}
	}

	var settingsAvoidedSongsList = '';
	var countAvoided = 0;
	settingsAvoidedSongsList += '<div class="settingsAvoidedSong" id="settingsAvoidedTop">';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongTitle">'+lang[codLang].settings.avoidedSongs.songTitle+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongArtist">'+lang[codLang].settings.avoidedSongs.artist+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongEndDate">'+lang[codLang].settings.avoidedSongs.endDate+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongUnAvoid">'+lang[codLang].settings.avoidedSongs.unavoid+'</div>';
		settingsAvoidedSongsList += '</div>';
	for (i in db.avoided) {
		var fecha = new Date(db.avoided[i]);
		settingsAvoidedSongsList += '<div class="settingsAvoidedSong" id="settingsAvoidedSong-'+i+'">';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongTitle">'+db.songs[i].title+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongArtist">'+db.songs[i].artist+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongEndDate">'+fecha.toLocaleDateString()+'</div>';
			settingsAvoidedSongsList += '<div class="settingsAvoidCell settingsAvoidedSongUnAvoid"><svg class="settingsUnAvoidSong" id="settingsUnAvoid-'+i+'" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><title>'+lang[codLang].settings.avoidedSongs.unavoidBtn+'</title><path d="M24,44a19.29,19.29,0,0,1-7.8-1.58A19.91,19.91,0,0,1,5.58,31.8a20.1,20.1,0,0,1,0-15.6A20,20,0,0,1,16.2,5.58a20.1,20.1,0,0,1,15.6,0,20.42,20.42,0,0,1,6.35,4.28,20.05,20.05,0,0,1,4.27,6.35A19.29,19.29,0,0,1,44,24a19.29,19.29,0,0,1-1.58,7.8A19.91,19.91,0,0,1,31.8,42.42,19.29,19.29,0,0,1,24,44Zm0-3a16.41,16.41,0,0,0,12-5,16.41,16.41,0,0,0,5-12,16.55,16.55,0,0,0-1-5.85,17.56,17.56,0,0,0-3-5.1L13.05,37a15.9,15.9,0,0,0,5.08,3A16.91,16.91,0,0,0,24,41ZM11.05,35,35,11.05a17.05,17.05,0,0,0-5.1-3A16.55,16.55,0,0,0,24,7,16.41,16.41,0,0,0,12,12,16.41,16.41,0,0,0,7,24a16.19,16.19,0,0,0,1.1,5.88A18.52,18.52,0,0,0,11.05,35Z" transform="translate(-4 -4)"/></svg></div>';
		settingsAvoidedSongsList += '</div>';
		countAvoided++;
	}
	if (countAvoided==0) {
		settingsAvoidedSongsList += '<div class="settingsAvoidedSong" id="settingsAvoidedSongNoResults"><p>'+lang[codLang].settings.avoidedSongs.noSongsAvoided+'</p></div>';
	}
	$('#settingsAvoidedList').html(settingsAvoidedSongsList);

	$('.settingsUnAvoidSong').on('click',function() {
		unavoidSong($(this).attr('id').substring(16));
	});
}

/* ---------------------- languages --------------------- */

function setLang(langISO) {
	(db.app.debug)?console.log('f:{setLang('+langISO+')}'):'';

	if (lang[langISO] == undefined) {
		codLang = 'es';
	} else {
		codLang = langISO;
	}

	// startup
	$('#startupWelcome').text(lang[codLang].startup.welcome);
	$('#startupIntroduction').text(lang[codLang].startup.intro);
	$('#startUrlAudio').attr('placeholder',lang[codLang].startup.audioPlaceholder);
	$('#startUrlCover').attr('placeholder',lang[codLang].startup.coverPlaceholder);
	$('#startupButtonClear').text(lang[codLang].startup.clearBtn);
	$('#startupButtonContinue').text(lang[codLang].startup.continueBtn);
	$('#startBackupExplanation').html(lang[codLang].startup.restoreOptionTxt);
	$('#startupBackupButton').text(lang[codLang].startup.restoreBtn);

	// navbar
	$('#navOptHome p').text(lang[codLang].nav.home);
	$('#navOptSongs p').text(lang[codLang].nav.mysongs);
	$('#navOptPlaylists p').text(lang[codLang].nav.myplaylists);
	$('#navOptSettings p').text(lang[codLang].nav.settings);
	$('.navOptPlaying').find('title').text(lang[codLang].nav.playingIcon);

	// homepage
	$('#tabHomeTitle h2').text(lang[codLang].homePage.homeTitle.replace('%%',db.app.name));
	$('#tabHomeTitleLeft p').text(lang[codLang].homePage.homeSubtitle);
	$('#homeSuggestedMore').text(lang[codLang].homePage.showAllSongs);
	$('#homeStatsSongs h4').text(lang[codLang].homePage.songs);
	$('#homeStatsPlayed h4').text(lang[codLang].homePage.totalPlays);
	$('#homeStatsArtists h4').text(lang[codLang].homePage.artists);
	$('#homeStatsPlaylists h4').text(lang[codLang].homePage.playlists);
	$('#tabHomeNotPlayedSongs h3').text(lang[codLang].homePage.notPlayedSongs);
	$('#tabHomeMostPlayed h3').text(lang[codLang].homePage.mostPlayedSongs);
	$('#homeMostPlayedMore').text(lang[codLang].homePage.showMore);
	$('#homeFirstStepsTitle h3').text(lang[codLang].homePage.firstSteps.title);
	$('#homeFirstStepSongs .homeFirstStepsName').text(lang[codLang].homePage.firstSteps.songs[0]);
	$('#homeFirstStepSongs .homeFirstStepsMore').text(lang[codLang].homePage.firstSteps.songs[1]);
	$('#homeFirstStepPlaylists .homeFirstStepsName').text(lang[codLang].homePage.firstSteps.playlists[0]);
	$('#homeFirstStepPlaylists .homeFirstStepsMore').text(lang[codLang].homePage.firstSteps.playlists[1]);
	$('#homeFirstStepBackup .homeFirstStepsName').text(lang[codLang].homePage.firstSteps.backup[0]);
	$('#homeFirstStepBackup .homeFirstStepsMore').text(lang[codLang].homePage.firstSteps.backup[1]);

	// mysongs
	$('#mySongsList h2').text(lang[codLang].mySongs.pageTitle);
	$('#searchBox').attr('placeholder',lang[codLang].mySongs.searchSongs);
	$('#songsRowTitle').text(lang[codLang].mySongs.songTitle);
	$('#songsRowArtist').text(lang[codLang].mySongs.songArtist);
	$('#songsRowAlbum').text(lang[codLang].mySongs.songAlbum);
	$('#songsRowGenre').text(lang[codLang].mySongs.songGenre);
	$('#songsRowDuration').text(lang[codLang].mySongs.songDuration);
	$('#songsRowAddedIn').text(lang[codLang].mySongs.songDateAdded);
	$('.tabTopLeftPlayingIcon').find('title').text(lang[codLang].nav.playingIcon);

	// myplaylists
	$('#searchBoxPlaylist').attr('placeholder',lang[codLang].mySongs.searchSongs);

	// addSong
	$('#tabAddSong .tabTopLeft h2').text(lang[codLang].addSong.title);
	$('#tabAddSong .tabTopLeft #tabTopInfo').text(lang[codLang].addSong.subtitle);
	$('#tabAddSong .tabTopSub p').text(lang[codLang].addSong.titleBanner);
	$('#addSongContent #addSongTitle p').text(lang[codLang].addSong.songTitle.desc);
	$('#addSongContent #addSongTitle input').attr('placeholder',lang[codLang].addSong.songTitle.placeholder);
	$('#addSongContent #addSongArtist p').text(lang[codLang].addSong.songArtist.desc);
	$('#addSongContent #addSongArtist input').attr('placeholder',lang[codLang].addSong.songArtist.placeholder);
	$('#addSongContent #addSongAlbum p').text(lang[codLang].addSong.songAlbum.desc);
	$('#addSongContent #addSongAlbum input').attr('placeholder',lang[codLang].addSong.songAlbum.placeholder);
	$('#addSongContent #addSongGenre p').text(lang[codLang].addSong.songGenre.desc);
	$('#addSongContent #addSongGenre input').attr('placeholder',lang[codLang].addSong.songGenre.placeholder);
	$('#addSongContent #addSongPublished p').text(lang[codLang].addSong.songPublished.desc);
	$('#addSongContent #addSongPublished input').attr('placeholder',lang[codLang].addSong.songPublished.placeholder);
	$('#addSongContent #addSongImage p').text(lang[codLang].addSong.songCover.desc);
	$('#addSongContent #addSongImage input').attr('placeholder',lang[codLang].addSong.songCover.placeholder);
	$('#addSongContent #addSongImage #addSongImageSelector p').text(lang[codLang].addSong.select);
	$('#addSongContent #addSongUrl p').text(lang[codLang].addSong.songAudio.desc);
	$('#addSongContent #addSongUrl input').attr('placeholder',lang[codLang].addSong.songAudio.placeholder);
	$('#addSongContent #addSongUrl #addSongUrlSelector p').text(lang[codLang].addSong.select);
	$('#addSongContent .addSongRequired').text(lang[codLang].addSong.requiredData);

	// editSong
	$('#tabEditSong .tabTopLeft h2').text(lang[codLang].editSong.title);
	$('#tabEditSong .tabTopLeft #tabTopInfo').text(lang[codLang].editSong.subtitle);
	$('#tabEditSong .tabTopSub p').text(lang[codLang].editSong.titleBanner);

	// deleteSong
	$('#dialogDeleteSong h2').text(lang[codLang].deleteSong.title);
	$('#dialogDeleteSong #dialogOptDeleteSongConfirm').text(lang[codLang].deleteSong.acceptBtn);
	$('#dialogDeleteSong #dialogOptDeleteSongCancel').text(lang[codLang].deleteSong.discardBtn);

	//newPlaylist
	$('#dialogCreatePlaylist h2').text(lang[codLang].newPlaylist.title);
	$('#dialogCreatePlaylist .dialogNewPlaylistText').text(lang[codLang].newPlaylist.mainMessage);
	$('#dialogCreatePlaylist #dialogNewPlaylistName').attr('placeholder',lang[codLang].newPlaylist.placeholder);
	$('#dialogCreatePlaylist #dialogNewPlaylistCreate p').text(lang[codLang].newPlaylist.acceptBtn);
	$('#dialogCreatePlaylist #dialogNewPlaylistCancel p').text(lang[codLang].newPlaylist.discardBtn);
	
	// renamePlaylist
	$('#dialogRenamePlaylist h2').text(lang[codLang].renamePlaylist.title);
	$('#dialogRenamePlaylist #dialogRenamePlaylistNewName').attr('placeholder',lang[codLang].renamePlaylist.placeholder);
	$('#dialogRenamePlaylist #dialogRenamePlaylistRename').text(lang[codLang].renamePlaylist.acceptBtn);
	$('#dialogRenamePlaylist #dialogRenamePlaylistCancel').text(lang[codLang].renamePlaylist.discardBtn);

	// deletePlaylist
	$('#dialogDeletePlaylist h2').text(lang[codLang].deletePlaylist.title);
	$('#dialogDeletePlaylist #dialogOptDeletePlaylistConfirm').text(lang[codLang].deletePlaylist.acceptBtn);
	$('#dialogDeletePlaylist #dialogOptDeletePlaylistCancel').text(lang[codLang].deletePlaylist.discardBtn);

	// settings
	$('#tabSettings .tabTop h2').text(lang[codLang].settings.title);
	$('#tabSettings #settingsBackup .settingsItemTop p').text(lang[codLang].settings.backup.title);
	$('#settingsBackup #settingsDownloadBackupText').text(lang[codLang].settings.backup.backupText);
	$('#settingsBackup #downloadData p').text(lang[codLang].settings.backup.backupBtn);
	$('#settingsBackup #lastDownload p').text(lang[codLang].settings.backup.lastBackup);
	$('#settingsBackup #settingsRestoreBackupText').text(lang[codLang].settings.backup.restoreText);
	$('#settingsBackup #restoreData p').text(lang[codLang].settings.backup.restoreBtn);
	$('#settingsBackup #restoreInfo p').text(lang[codLang].settings.backup.restoreNoSelected);
	$('#settingsBackup #restoreConfirm p').text(lang[codLang].settings.backup.restoreConfirmBtn);

	$('#tabSettings #settingsDarkMode .settingsItemTop p').text(lang[codLang].settings.darkMode.title);
	$('#settingsDarkMode #settingsDarkModeText').text(lang[codLang].settings.darkMode.message);
	$('#settingsDarkMode #settingsDarkModeEnabled').text(lang[codLang].settings.darkMode.enabled);
	$('#settingsDarkMode #settingsDarkModeDisabled').text(lang[codLang].settings.darkMode.disabled);

	$('#tabSettings #settingsShowPlaylists .settingsItemTop p').text(lang[codLang].settings.showPlaylists.title);
	$('#settingsShowPlaylists #settingsShowPlaylistsText').text(lang[codLang].settings.showPlaylists.message);
	$('#settingsShowPlaylists #settingsShowPlaylistsEnabled').text(lang[codLang].settings.showPlaylists.enabled);
	$('#settingsShowPlaylists #settingsShowPlaylistsDisabled').text(lang[codLang].settings.showPlaylists.disabled);

	$('#tabSettings #settingsFileLocation .settingsItemTop p').text(lang[codLang].settings.fileLocations.title);
	$('#settingsFileLocation #settingsAudioFileMsg').text(lang[codLang].settings.fileLocations.audioMessage);
	$('#settingsFileLocation #settingsFileLocationUrl').attr('placeholder',lang[codLang].settings.fileLocations.audioPlaceholder);
	$('#settingsFileLocation #settingsCoverFileMsg').text(lang[codLang].settings.fileLocations.coverMessage);
	$('#settingsFileLocation #settingsCoverLocationUrl').attr('placeholder',lang[codLang].settings.fileLocations.coverPlaceholder);
	$('#settingsFileLocationSubmit p, #settingsCoverLocationSubmit p').text(lang[codLang].settings.fileLocations.change);

	$('#tabSettings #settingsItemAvoided .settingsItemTop p').text(lang[codLang].settings.avoidedSongs.title);
	$('#settingsItemAvoided #settingsAvoidSongsMsg').html(lang[codLang].settings.avoidedSongs.message);

	$('#tabSettings #settingsLanguage .settingsItemTop p').text(lang[codLang].settings.language.title);
	$('#tabSettings #settingsLanguage #settingsItemLangMsg').text(lang[codLang].settings.language.message);

	$('#tabSettings #settingsItemSpace .settingsItemTop p').text(lang[codLang].settings.availableStorage.title);
	$('#settingsItemSpace #settingsItemSpaceMsg').html(lang[codLang].settings.availableStorage.message);
}

function loadLangSelects() {
	(db.app.debug)?console.log('f:{loadLangSelects()}'):'';

	var html = '';
	for (i in lang) {
		if (i == codLang) {
			html += '<option value="'+i+'" selected>'+lang[i].langName+'</option>';
		} else {
			html += '<option value="'+i+'">'+lang[i].langName+'</option>';
		}
	}

	$('#settingsSelectLang, #startupLangSelector').html(html);

	$('#settingsSelectLang').on('change',function() {
		var selectedLang = $('#settingsSelectLang').val();

		if (lang[selectedLang] != undefined) {
			db.settings.lang = selectedLang;
			setLang(selectedLang);
			if (currentTab=='tabSettings') {
				showSettings();
				updateAvoidedSongsList();
			}
			localStorage.setItem(storageName,JSON.stringify(db));
		} else {
			$('#settingsSelectLang').val(codLang);
			errorReporting(lang[codLang].errors.general.changeLangErr1);
		}
	});

	$('#startupLangSelector').on('change',function() {
		var selectedLang = $('#startupLangSelector').val();

		if (lang[selectedLang] != undefined) {
			db.settings.lang = selectedLang;
			setLang(selectedLang);
			localStorage.setItem(storageName,JSON.stringify(db));
		}
	});
}

/* -------------------- context menu -------------------- */

$(function() {
	//EVITAMOS que se muestre el MENU CONTEXTUAL del sistema operativo al hacer CLICK con el BOTON DERECHO del RATON
	$(document).bind("contextmenu", function(e){
        var target = $(e.target);

        //console.log(target.parents('.item').length); // booleano que indica si existe un elemento padre con una clase determinada
        //console.log(target.closest('.item').attr('onclick')); // obtener el primer elemento padre con una clase determinada
        //console.log(target.closest('.item').attr('onclick').substring(target.closest('.item').attr('onclick').indexOf('(')+1, target.closest('.item').attr('onclick').indexOf(')')));
        //console.log(target.closest('.item').attr('onclick').indexOf('('));
        //console.log(target.closest('.item').attr('onclick').indexOf(')'));

        if (target.parents('#listAllSongs').length) { // detecta si elemento sobre el que se hace click es hijo de .item
        	$('#context>ul').html('');
        	unselectItem();
        	$(target.parents('.allSongsItem')).addClass('songsItemSelected');
        	if (!target.parents('.allSongsItem').hasClass('allSongsNoResults') && !target.parent('.allSongsNoResults').hasClass('allSongsNoResults')) {
        		$('#context>ul').append('<li id="contextEditSong" class="contextEdit-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.editSong+'</li>');
        		$('#context>ul').append('<li id="contextDeleteSong" class="contextDelete-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.deleteSong+'</li>');
        		if (db.avoided[target.closest('.allSongsItem').attr('id').substring(13)] == undefined) {
	        		$('#context>ul').append('<li id="contextAvoidSong" class="contextSkip-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.avoidSong+'</li>');
	        	} else {
	        		$('#context>ul').append('<li id="contextUnAvoidSong" class="contextSkip-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.unavoidSong+'</li>');
	        	}
        		$('#context>ul').append('<li id="contextAddPlaylist" class="contextAdd-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.addToPlaylist+'</li>');
        		$('#context>ul').append('<div id="contextSelectPlaylist"></div>');
        		for (i in db.playlists) {
        			if (db.playlists[i].songs.includes(target.closest('.allSongsItem').attr('id').substring(13))) {
        				$('#contextSelectPlaylist').append('<li id="contextSelectPl" class="disabled contextSelectPl-'+i+'-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+db.playlists[i].name+'</li>');
        			} else {
        				$('#contextSelectPlaylist').append('<li id="contextSelectPl" class="contextSelectPl-'+i+'-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+db.playlists[i].name+'</li>');
        			}
        		}
        		$('#contextSelectPlaylist').append('<li id="contextSelectNewPl" class="contextSelectNewPl-'+target.closest('.allSongsItem').attr('id').substring(13)+'">'+lang[codLang].context.newPlaylist+'</li>');
        	}
			menu.css({'display':'block', 'left':e.pageX, 'top':e.pageY});
	   		return false;

		} else if (target.parents('#listAllPlaylistSongs').length) {
			$('#context>ul').html('');
			unselectItem();
        	$(target.parents('.allSongsItem')).addClass('songsItemSelected');

        	if (!target.parents('.allSongsItem').hasClass('allSongsNoResults') && !target.hasClass('allSongsNoResults')) {
        		$('#context>ul').append('<li id="contextEditSong" class="contextEdit-'+target.closest('.allSongsItem').attr('id').split('-')[1]+'">'+lang[codLang].context.editSong+'</li>');
        		$('#context>ul').append('<li id="contextRemovePlaylistSong" class="contextRemovePlSong-'+target.closest('.allSongsItem').attr('id').split('-')[1]+'-'+target.closest('.allSongsItem').attr('id').split('-')[2]+'">'+lang[codLang].context.removeSongFromPlaylist+'</li>');
        		if (db.avoided[target.closest('.allSongsItem').attr('id').split('-')[1]] == undefined) {
	 	       		$('#context>ul').append('<li id="contextAvoidSong" class="contextSkip-'+target.closest('.allSongsItem').attr('id').split('-')[1]+'">'+lang[codLang].context.avoidSong+'</li>');
	 	       	} else {
	 	       		$('#context>ul').append('<li id="contextUnAvoidSong" class="contextSkip-'+target.closest('.allSongsItem').attr('id').split('-')[1]+'">'+lang[codLang].context.unavoidSong+'</li>');
	 	       	}
        		menu.css({'display':'block', 'left':e.pageX, 'top':e.pageY});
		   		return false;
        	}	
		} else if (target.parents('#navPlaylistList').length) {
			$('#context>ul').html('');
			$('#context>ul').append('<li id="contextEditPlaylist" class="contextEditPl-'+target.closest('.navOptPlaylistItem').attr('id').split('-')[1]+'">'+lang[codLang].context.renamePlaylist+'</li>');
			$('#context>ul').append('<li id="contextDeletePlaylist" class="contextDeletePl-'+target.closest('.navOptPlaylistItem').attr('id').split('-')[1]+'">'+lang[codLang].context.deletePlaylist+'</li>');
			menu.css({'display':'block', 'left':e.pageX, 'top':e.pageY});
	   		return false;
		} else if ($(target).attr('id') == 'navOptPlaylists' || target.parents('#navOptPlaylists').length) {
			$('#context>ul').html('');
			$('#context>ul').append('<li id="contextCreatePlaylist">'+lang[codLang].context.newPlaylist+'</li>');
			menu.css({'display':'block', 'left':e.pageX, 'top':e.pageY});
	   		return false;
		}
	});

	//variables de control
	var menuId = "context";
	var menu = $("#"+menuId);

	//Control sobre las opciones del menu contextual
	menu.click(function(e){
	    //si la opcion esta desactivada, no pasa nada
	    if(e.target.className == "disabled"){
	    	unselectItem();
	        return false;
	    }
	    //si esta activada, gestionamos cada una y sus acciones
	    else{
	        switch(e.target.id){
	        	// context from songList or playlistList
	            case "contextEditSong":
	            	(db.app.debug)?console.log('clic en context edit cat'):'';
	            	unselectItem();
	            	showEditSongDialog($(e.target).attr('class').substring(12));
	                break;
	            case "contextDeleteSong":
	            	unselectItem();
	            	deleteSongConfirmation($(e.target).attr('class').substring(14));
	                break;
	            case "contextSelectPl":
	            	unselectItem();
	            	if (!$(e.target).attr('class').includes('disabled')) {
	            		let addPlaylistId = $(e.target).attr('class').split('-')[1];
		            	let addSongId = $(e.target).attr('class').split('-')[2];

		            	addSongToPlaylist(addSongId,addPlaylistId);
	            	} else {
	            		// #4302 addSongErr2 - The song already is in this playlist
	            		errorReporting(lang[codLang].errors.playlists.addSongErr2);
	            	}
	            	break;
	            case "contextSelectNewPl":
	            	unselectItem();
	            	let newPlSongId = $(e.target).attr('class').split('-')[1];

	            	addPlaylistConfirmation(newPlSongId);
	            	break;
	            // context from playlistList
	            case "contextRemovePlaylistSong":
	            	unselectItem();
	            	let remPlaylistId = $(e.target).attr('class').split('-')[2];
	            	let remSongId = $(e.target).attr('class').split('-')[1];

	            	removePlaylistSong(remPlaylistId,remSongId);
	            	break;
	            case "contextEditPlaylist":
	            	unselectItem();
	            	let editPlaylist = $(e.target).attr('class').split('-')[1];

	            	renamePlaylistConfirmation(editPlaylist);
	            	break;
	            case "contextDeletePlaylist":
	            	unselectItem();
	            	let deletePlaylist = $(e.target).attr('class').split('-')[1];

	            	deletePlaylistConfirmation(deletePlaylist);
	            	break;
	            // context from all playlist button
	            case "contextCreatePlaylist":
	            	unselectItem();

	            	addPlaylistConfirmation();
	            	break;
	            case "contextAvoidSong":
	            	unselectItem();
	            	let avoidedSong = $(e.target).attr('class').split('-')[1];
	            	avoidSong(avoidedSong);
	            	break;
	            case "contextUnAvoidSong":
	            	unselectItem();
	            	let unavoidedSong = $(e.target).attr('class').split('-')[1];
	            	unavoidSong(unavoidedSong);
	            	break;
	        }
	        menu.css("display", "none");
	    }
	});

	//controlamos ocultado de menu cuando esta activo
	//click boton principal raton
	$(document).click(function(e){
		try {
		    if(e.button == 0 && e.target.parentNode.parentNode.id != menuId){
		        menu.css("display", "none");
		        unselectItem();
		    }
		} catch { }
	});
	//pulsacion tecla escape
	$(document).keydown(function(e){
	    if(e.keyCode == 27){
	        menu.css("display", "none");
	        unselectItem();
	    }
	});

	function unselectItem() {
		$('.allSongsItem').removeClass('songsItemSelected');
	}
});

// ------------------ combinaciones de teclas ------------------ */

document.onkeydown = function(e) {
	console.log('keydown: '+window.event.keyCode);
	if (document.activeElement.tagName != 'INPUT' || $(document.activeElement).attr('type') != 'text') {
		if (window.event.keyCode == 70) { // letra f
			e.preventDefault();
			if (currentTab=='tabSongs') { $('#searchBox').focus(); }
			else { $('#searchBoxPlaylist').focus(); }
		}

		if (player.queue.origin!='') {
			if (window.event.keyCode == 32) { // espacio
				e.preventDefault();
				if (document.getElementById('mainPlayer').paused) {
					$('#footerControlPlay').click();
				} else {
					$('#footerControlPause').click();
				}
			}
			if (window.event.keyCode == 177 || window.event.keyCode == 33) { // media prev
				e.preventDefault();
				prevSong();
			}
			if (window.event.keyCode == 176 || window.event.keyCode == 34) { // media next
				e.preventDefault();
				nextSong();
			}
			if (window.event.keyCode == 36) { // inicio
				e.preventDefault();
				document.getElementById('mainPlayer').currentTime = 0;
			}
			if (window.event.keyCode == 35) { // fin
				e.preventDefault();
				document.getElementById('mainPlayer').currentTime = document.getElementById('mainPlayer').duration;
			}
			if (window.event.keyCode == 37) { // flecha izquierda
				e.preventDefault();
				rewindSong(5);
			}
			if (window.event.keyCode == 74) { // letra j
				e.preventDefault();
				rewindSong(10);
			}
			if (window.event.keyCode == 39) { // flecha derecha
				e.preventDefault();
				forwardSong(5);
			}
			if (window.event.keyCode == 76) { // letra l
				e.preventDefault();
				forwardSong(10);
			}
			if (window.event.keyCode == 38) { // flecha arriba
				e.preventDefault();
				if (db.settings.mute==true) {
					toggleMute();
				}
				if (db.settings.volume >95) {
					setVolume(100);
				} else {
					setVolume(parseInt(db.settings.volume)+5);
				}
			}
			if (window.event.keyCode == 40) { // flecha abajo
				e.preventDefault();
				if (db.settings.mute==true) {
					toggleMute();
				}
				if (db.settings.volume <5) {
					setVolume(0);
				} else {
					setVolume(parseInt(db.settings.volume)-5);
				}
			}
			if (window.event.keyCode == 77) { // letra m
				e.preventDefault();
				toggleMute();
			}

			if (window.event.keyCode == 48) { // número 0
				e.preventDefault();
				songSeekPart(0);
			}
			if (window.event.keyCode == 49) { // número 1
				e.preventDefault();
				songSeekPart(1);
			}
			if (window.event.keyCode == 50) { // número 2
				e.preventDefault();
				songSeekPart(2);
			}
			if (window.event.keyCode == 51) { // número 3
				e.preventDefault();
				songSeekPart(3);
			}
			if (window.event.keyCode == 52) { // número 4
				e.preventDefault();
				songSeekPart(4);
			}
			if (window.event.keyCode == 53) { // número 5
				e.preventDefault();
				songSeekPart(5);
			}
			if (window.event.keyCode == 54) { // número 6
				e.preventDefault();
				songSeekPart(6);
			}
			if (window.event.keyCode == 55) { // número 7
				e.preventDefault();
				songSeekPart(7);
			}
			if (window.event.keyCode == 56) { // número 8
				e.preventDefault();
				songSeekPart(8);
			}
			if (window.event.keyCode == 57) { // número 9
				e.preventDefault();
				songSeekPart(9);
			}
		}
	} else {
		if (window.event.keyCode == 27) { // escape
			if (document.activeElement != document.body) document.activeElement.blur();
		}
	}
	/*if (window.event.keyCode == 86) { if (event.altKey) { changeView('List') } } // alt+v
	if (window.event.keyCode == 88) { if (event.altKey) { showTree() } } // alt+x
	if (window.event.keyCode == 72) { if (event.altKey) { showHistory(true) } } // alt+h
    if (window.event.keyCode == 83) { if (event.altKey) { showSettings(true) } } // alt+s
    if (window.event.keyCode == 37) { if (event.altKey) { event.preventDefault(); prevPath() } } // alt+flecha izquierda
    if (window.event.keyCode == 39) { if (event.altKey) { event.preventDefault(); nextPath() } } // alt+flecha derecha

	if (window.event.keycode == 8) {
		if (db.app.debug){console.log('backspace')};
	}*/
}

/* -------------------- utils -------------------- */

function getRandomId(length) {
	(db.app.debug)?console.log('f:{getRandomId}'):'';
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

function twoDigits(num) {
	if (num<10) {
		return '0'+num;
	} else {
		return num;
	}
}

function sortSongs(obj) {
	let sortable = [];
	var response = [];
	for (var song in obj) {
	    sortable.push([song, obj[song].addedIn]);
	}

	sortable.sort(function(a, b) {
	    return b[1] - a[1];
	});

	for (i in sortable) {
		response.push(sortable[i][0]);
	}

	return response;
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function shuffleSongList(array) {
	(db.app.debug)?console.log('f:{shuffleSongList}'):'';

	console.log(array);

	let currentIndex = array.length, randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex != 0) {
	    // Pick a remaining element.
	    randomIndex = Math.floor(Math.random() * currentIndex);
	    currentIndex--;

	    // And swap it with the current element.
	    [array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
	}

	console.log(array);

	return array;
}

function getRandomCode(length) {
	(db.app.debug)?console.log('f:{getRandomCode}'):'';
	var code = '';
	for (i=0;i<length;i++) {
		code += Math.floor(Math.random() * 10);
	}
	return code;
}

function setAlert(level,element,msg,callback) {
	(db.app.debug)?console.log('f:{setAlert('+level+','+element+','+msg+')}'):'';

	var code = getRandomCode(6);

	var html = '';
	if (level=='info') {
		html += '<div id="alert-'+code+'" class="homeAlert homeAlertInfo">';
		html += '<svg class="homeAlertLogo" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><title>info</title><path d="M22.65,34h3V22h-3ZM24,18.3a1.61,1.61,0,0,0,1.17-.45,1.5,1.5,0,0,0,.48-1.15,1.66,1.66,0,0,0-.48-1.2,1.62,1.62,0,0,0-2.34,0,1.66,1.66,0,0,0-.48,1.2,1.5,1.5,0,0,0,.48,1.15A1.61,1.61,0,0,0,24,18.3ZM24,44a19.19,19.19,0,0,1-7.75-1.58,20.14,20.14,0,0,1-6.37-4.29,20.53,20.53,0,0,1-4.31-6.38,20,20,0,0,1,0-15.55A20.16,20.16,0,0,1,9.88,9.85a20.43,20.43,0,0,1,6.37-4.27,20,20,0,0,1,15.55,0,20.42,20.42,0,0,1,6.35,4.28,20.05,20.05,0,0,1,4.27,6.35A19.29,19.29,0,0,1,44,24a19.19,19.19,0,0,1-1.58,7.75,20.42,20.42,0,0,1-4.27,6.38,19.94,19.94,0,0,1-6.35,4.29A19.29,19.29,0,0,1,24,44Zm.05-3a16.32,16.32,0,0,0,12-5A16.5,16.5,0,0,0,41,24a16.34,16.34,0,0,0-5-12A16.41,16.41,0,0,0,24,7,16.4,16.4,0,0,0,12,12,16.36,16.36,0,0,0,7,24a16.39,16.39,0,0,0,5,12A16.45,16.45,0,0,0,24.05,41Z" transform="translate(-4 -4)"/></svg>';
	} else if (level=='warning') {
		html += '<div id="alert-'+code+'" class="homeAlert homeAlertWarning">';
		html += '<svg class="homeAlertLogo" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="44" height="38" viewBox="0 0 44 38"><title>warning</title><path d="M2,42,24,4,46,42Zm5.2-3H40.8L24,10Zm17-2.85a1.44,1.44,0,0,0,1.5-1.5,1.45,1.45,0,0,0-1.5-1.5,1.47,1.47,0,0,0-1.5,1.5,1.45,1.45,0,0,0,1.5,1.5ZM22.7,30.6h3V19.4h-3Z" transform="translate(-2 -4)"/></svg>';
	}
	html += '<p>'+msg+'</p>';
	html += '<svg class="homeAlertClose" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" width="27.3" height="27.3" viewBox="0 0 27.3 27.3"><title>close</title><path d="M12.45,37.65l-2.1-2.1L21.9,24,10.35,12.45l2.1-2.1L24,21.9,35.55,10.35l2.1,2.1L26.1,24,37.65,35.55l-2.1,2.1L24,26.1Z" transform="translate(-10.35 -10.35)"/></svg>';
	html += '</div>';

	$(element).append(html);

	$('#alert-'+code+' .homeAlertClose').on('click',function() {
		$(this).parent().hide(200);
		setTimeout(function() {
			$(this).parent().remove();
			callback('#alert-'+code);
		},400);
	});
}

function pickRandomProperty(obj) {
    var result;
    var count = 0;
    for (var prop in obj)
        if (Math.random() < 1/++count)
           result = prop;
    return result;
}

function formatSeconds(s) {
	s = Math.floor(s);
	var min = Math.floor(s/60);
	var sec = s%60;
	if (sec<10) {
		sec = '0'+sec;
	}

	return min+':'+sec;
}

function relativeDate(date,format) {
	// format => 'full'			para fecha completa con numeros
	// format => 'relative'		para valor relativo a la fecha actual

	if (date==false) {
		fResult = lang[codLang].homePage.notPlayedEver;
		return fResult;
	} else {
		fActual = new Date();
		fSong = new Date(date);

		var recentValue = false;

		fDiff = Math.abs(fActual.getTime() - fSong.getTime());

		fMinutes = Math.floor(fDiff / (1000 * 60));
		fHours = Math.floor(fDiff / (1000 * 3600));
		fDays = Math.floor(fDiff / (1000 * 3600 * 24));
		fMonths = Math.floor(fDiff / (1000*3600*24*31));
		fYears = Math.floor(fDiff / (1000*3600*24*365));

		if (fYears>0) {
			if (fYears==1) { fResult = lang[codLang].homePage.notPlayedSince.years[0].replace('%%',fYears); }
			else { fResult = lang[codLang].homePage.notPlayedSince.years[1].replace('%%',fYears); }
		} else if (fMonths>0) {
			if (fMonths==1) { fResult = lang[codLang].homePage.notPlayedSince.months[0].replace('%%',fMonths); }
			else { fResult = lang[codLang].homePage.notPlayedSince.months[1].replace('%%',fMonths); }
		} else if (fDays>0) {
			if (fDays==1) { fResult = lang[codLang].homePage.notPlayedSince.days[0].replace('%%',fDays); }
			else { fResult = lang[codLang].homePage.notPlayedSince.days[1].replace('%%',fDays); }
		} else if (fHours>0) {
			if (fHours==1) { fResult = lang[codLang].homePage.notPlayedSince.hours[0].replace('%%',fHours); }
			else { fResult = lang[codLang].homePage.notPlayedSince.hours[1].replace('%%',fHours); }
		} else {
			if (fMinutes==1) { fResult = lang[codLang].homePage.notPlayedSince.minutes[0].replace('%%',fMinutes); }
			else { fResult = lang[codLang].homePage.notPlayedSince.minutes[1].replace('%%',fMinutes); }
		}

		if (format=='full') {
			return twoDigits(fSong.getDate())+'-'+twoDigits(fSong.getMonth()+1)+'-'+fSong.getFullYear()+' '+timeFormat(fSong.getHours()+':'+fSong.getMinutes());
		} else { // relative
			return fResult;
		}
	}
	
}

function timeFormat(time,raw=false) {
	if (raw) {
		if (time.includes('PT')) {time = time.replace('PT',''); }
		if (time.includes('H'))  { time = time.replace('H',':'); }
		if (time.includes('M'))  { time = time.replace('M',':'); }
		if (time.includes('S'))  { time = time.replace('S',''); }
	}

	if (time.indexOf(':')==-1) {
		time = '0:'+time;
	} else if (time.substring(time.length-1)==':') {
		time = time+'0';
	}
	
	var splitted = time.split(":");

	for (i in splitted) {
		if (parseInt(splitted[i])<10) {
			splitted[i] = '0'+splitted[i];
		}
	}

	return splitted.join(':');
}

function removeDiacritics(str) {
	var defaultDiacriticsRemovalMap = [
        {'base':'A', 'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'},
        {'base':'AA','letters':'\uA732'},
        {'base':'AE','letters':'\u00C6\u01FC\u01E2'},
        {'base':'AO','letters':'\uA734'},
        {'base':'AU','letters':'\uA736'},
        {'base':'AV','letters':'\uA738\uA73A'},
        {'base':'AY','letters':'\uA73C'},
        {'base':'B', 'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
        {'base':'C', 'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
        {'base':'D', 'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\u00D0'},
        {'base':'DZ','letters':'\u01F1\u01C4'},
        {'base':'Dz','letters':'\u01F2\u01C5'},
        {'base':'E', 'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
        {'base':'F', 'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
        {'base':'G', 'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
        {'base':'H', 'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
        {'base':'I', 'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
        {'base':'J', 'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
        {'base':'K', 'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
        {'base':'L', 'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
        {'base':'LJ','letters':'\u01C7'},
        {'base':'Lj','letters':'\u01C8'},
        {'base':'M', 'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
        {'base':'N', 'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
        {'base':'NJ','letters':'\u01CA'},
        {'base':'Nj','letters':'\u01CB'},
        {'base':'O', 'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'},
        {'base':'OI','letters':'\u01A2'},
        {'base':'OO','letters':'\uA74E'},
        {'base':'OU','letters':'\u0222'},
        {'base':'OE','letters':'\u008C\u0152'},
        {'base':'oe','letters':'\u009C\u0153'},
        {'base':'P', 'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
        {'base':'Q', 'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
        {'base':'R', 'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
        {'base':'S', 'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
        {'base':'T', 'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
        {'base':'TZ','letters':'\uA728'},
        {'base':'U', 'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
        {'base':'V', 'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
        {'base':'VY','letters':'\uA760'},
        {'base':'W', 'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
        {'base':'X', 'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
        {'base':'Y', 'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
        {'base':'Z', 'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
        {'base':'a', 'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'},
        {'base':'aa','letters':'\uA733'},
        {'base':'ae','letters':'\u00E6\u01FD\u01E3'},
        {'base':'ao','letters':'\uA735'},
        {'base':'au','letters':'\uA737'},
        {'base':'av','letters':'\uA739\uA73B'},
        {'base':'ay','letters':'\uA73D'},
        {'base':'b', 'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
        {'base':'c', 'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
        {'base':'d', 'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
        {'base':'dz','letters':'\u01F3\u01C6'},
        {'base':'e', 'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
        {'base':'f', 'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
        {'base':'g', 'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
        {'base':'h', 'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
        {'base':'hv','letters':'\u0195'},
        {'base':'i', 'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
        {'base':'j', 'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
        {'base':'k', 'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
        {'base':'l', 'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
        {'base':'lj','letters':'\u01C9'},
        {'base':'m', 'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
        {'base':'n', 'letters':'\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'},
        {'base':'nj','letters':'\u01CC'},
        {'base':'o', 'letters':'\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'},
        {'base':'oi','letters':'\u01A3'},
        {'base':'ou','letters':'\u0223'},
        {'base':'oo','letters':'\uA74F'},
        {'base':'p','letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
        {'base':'q','letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
        {'base':'r','letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
        {'base':'s','letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
        {'base':'t','letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
        {'base':'tz','letters':'\uA729'},
        {'base':'u','letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
        {'base':'v','letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
        {'base':'vy','letters':'\uA761'},
        {'base':'w','letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
        {'base':'x','letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
        {'base':'y','letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
        {'base':'z','letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
    ];

    var diacriticsMap = {};
    for (var i=0; i < defaultDiacriticsRemovalMap .length; i++){
        var letters = defaultDiacriticsRemovalMap [i].letters;
        for (var j=0; j < letters.length ; j++){
            diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap [i].base;
        }
    }

    return str.replace(/[^\u0000-\u007E]/g, function(a){ 
       return diacriticsMap[a] || a; 
    });
}