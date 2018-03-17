
  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyAq_u6F9ScIvv3cjx06WTdEKS52zI4y0Lc",
    authDomain: "web-portfolio-7a7e8.firebaseapp.com",
    databaseURL: "https://web-portfolio-7a7e8.firebaseio.com",
    projectId: "web-portfolio-7a7e8",
    storageBucket: "",
    messagingSenderId: "726181406791"
  };
  firebase.initializeApp(config);


$("#submit-email").click(function(){

    var newSubscriber = firebase.database().ref("subscribers").push();
    newSubscriber.set({
        "name" : $('#reg-name'),
        "email" : $("#reg-email"),
        "date" : getCurrentDate()
    }, function(error){
        if(error)   console.log("Error adding subscription");
        else console.log("subsribed successfully");
    });
    
});


function getCurrentDate(){
    var formattedDate = new Date();
    var d = formattedDate.getDate();
    var m =  formattedDate.getMonth();
    m += 1;  // JavaScript months are 0-11
    var y = formattedDate.getFullYear();

    $("#txtDate").val(d + "-" + m + "-" + y);
}
