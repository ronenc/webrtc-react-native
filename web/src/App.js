import React, { Component } from 'react';

import socketClient from "socket.io-client";

const SERVER = "https://ece6-70-71-185-138.ngrok.io";
//const SERVER = "http://127.0.0.1:5000/";
//const SERVER = "https://b8fb-70-71-185-138.ngrok.io"
//let socket;

let connectedUserSocketId

class App extends Component {
  constructor(props) {
    super(props)

    // https://reactjs.org/docs/refs-and-the-dom.html
    this.localVideoref = React.createRef()
    this.remoteVideoref = React.createRef()

    this.socket = null
    this.candidates = []

    //this.socket = io.connect(SERVER)
  }

  
  componentDidMount = () => {

    //this.socket = io.connect(SERVER)
    this.socket = socketClient(SERVER);

/*
    this.socket = io.connect(
      //'https://8aa7a006.ngrok.io/webrtcPeer',
      'https://8264-70-71-185-138.ngrok.io/webrtcPeer',
      {
        path: '/io/webrtc',
        query: {}
      }
    )
*/

    this.socket.on("connection", () => {
      console.log("succesfully connected with wss server");
      console.log(this.socket.id);
      registerNewUser("web-user");
    })

    this.socket.on('connection-success', success => {
      console.log(success)
    })

    this.socket.on("broadcast", (data) => {
      handleBroadcastEvents(data);
    })
  
    this.socket.on("webRTC-offer", (data) => {
      console.log("webRTC-offer")
      handleOffer(data);
    });

    this.socket.on("webRTC-answer", (data) => {
      console.log("webRTC-answer")
      handleAnswer(data);
    });
    
    this.socket.on("webRTC-candidate", (data) => {
      console.log("webRTC-candidate", data.candidate)
      this.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    });
  
    this.socket.on('offerOrAnswer', (sdp) => {

      this.textref.value = JSON.stringify(sdp)

      // set sdp as remote description
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    })
/*
    this.socket.on('candidate', (candidate) => {
      // console.log('From Peer... ', JSON.stringify(candidate))
      // this.candidates = [...this.candidates, candidate]
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    })
*/
    // const pc_config = null

    const pc_config = {
      "iceServers": [
        // {
        //   urls: 'stun:[STUN_IP]:[PORT]',
        //   'credentials': '[YOR CREDENTIALS]',
        //   'username': '[USERNAME]'
        // },
        {
          urls : 'stun:stun.l.google.com:19302'
        }
      ]
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
    // create an instance of RTCPeerConnection
    this.pc = new RTCPeerConnection(pc_config)

    // triggered when a new candidate is returned
    this.pc.onicecandidate = (e) => {
      //debugger
      // send the candidates to the remote peer
      // see addCandidate below to be triggered on the remote peer
      if (e.candidate) {
        // console.log(JSON.stringify(e.candidate))
        this.socket.emit("webRTC-candidate", {
          candidate: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex
          },
          connectedUserSocketId: connectedUserSocketId
        });

        //this.sendToPeer('candidate', e.candidate)
      }
    }

    // triggered when there is a change in connection state
    this.pc.oniceconnectionstatechange = (e) => {
      console.log('oniceconnectionstatechange', e)
    }

    // triggered when a stream is added to pc, see below - this.pc.addStream(stream)
    this.pc.onaddstream = (e) => {
      //debugger
      this.remoteVideoref.current.srcObject = e.stream
     }

    this.pc.ontrack = (e) => {
      if (e.streams.length > 0) {
        //debugger
        console.log(e.streams[0])
        this.remoteVideoref.current.srcObject = e.streams[0]
      }
    }

    const registerNewUser = (username) => {
      this.socket.emit("register-new-user", {
        username: username,
        socketId: this.socket.id,
      });
    };
    
    const handleBroadcastEvents = (data) => {
      console.log("handleBroadcastEvents")
      switch (data.eventname) {
        case "ACTIVE_USERS":
          const activeUsers = data.activeUsers.filter(
            (activeUser) => activeUser.socketId !== this.socket.id
          );

          if (activeUsers.length > 0) {
            connectedUserSocketId = activeUsers[0].socketId
            console.log("handleBroadcastEvents", connectedUserSocketId)
          }
          //store.dispatch(dashboardActions.setActiveUsers(activeUsers));
          break;
        default:
          break;
      }
    };


    const handleOffer = async (data) => {
      console.log('handleOffer: ', data)
      this.pc.setRemoteDescription(new RTCSessionDescription( {
        sdp: data.offer,
        type: 'offer'
      }))
      this.createAnswer()
    };
    
    const handleAnswer = async (data) => {
      console.log('handleAnswer: ', data)
      this.pc.setRemoteDescription(new RTCSessionDescription( {
        sdp: data.answer,
        type: 'answer'
      }))
    };
    
    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      //debugger
      window.localStream = stream
      this.localVideoref.current.srcObject = stream
      this.pc.addStream(stream)
    }

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      // audio: true,
      video: true,
      // video: {
      //   width: 1280,
      //   height: 720
      // },
      // video: {
      //   width: { min: 1280 },
      // }
      options: {
        mirror: true,
      }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    navigator.mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure)
  }

  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload
    })
  }

  /* ACTION METHODS FROM THE BUTTONS ON SCREEN */

  sendPreOffer = () => {
    this.sendPreOfferActual()
    //this.sendPreOfferActual()
  }

  sendPreOfferActual = () => {
    console.log('PreOffer', connectedUserSocketId)
    this.socket.emit('pre-offer', {
      callee: {
        socketId: connectedUserSocketId,
      },
      caller: {
        username: 'web-user'
      }
    })
  }


  createOffer = () => {
    console.log('Offer')

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
    // initiates the creation of SDP
    this.pc.createOffer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        console.log(JSON.stringify(sdp))

        // set offer sdp as local description
        this.pc.setLocalDescription(sdp)

        //this.sendToPeer('offerOrAnswer', sdp)
        this.socket.emit("webRTC-offer", {
          calleeSocketId: connectedUserSocketId,
          offer: sdp.sdp
        })
    })
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer
  // creates an SDP answer to an offer received from remote peer
  createAnswer = () => {
    console.log('Answer')
    this.pc.createAnswer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        console.log('answer', JSON.stringify(sdp))

        // set answer sdp as local description
        this.pc.setLocalDescription(sdp)
        //console.log(sdp)

        //this.sendToPeer('offerOrAnswer', sdp)
        this.socket.emit("webRTC-answer", {
          callerSocketId: connectedUserSocketId,
          answer: sdp.sdp
        })
      })
  }

  setRemoteDescription = () => {
    // retrieve and parse the SDP copied from the remote peer
    console.log('setRemoteDescription', this.textref.value)
    const desc = JSON.parse(this.textref.value)

    // set sdp as remote description
    this.pc.setRemoteDescription(new RTCSessionDescription(desc))
  }

  addCandidate = () => {
    // retrieve and parse the Candidate copied from the remote peer
    // const candidate = JSON.parse(this.textref.value)
    // console.log('Adding candidate:', candidate)

    // add the candidate to the peer connection
    // this.pc.addIceCandidate(new RTCIceCandidate(candidate))

    console.log('addCandidate')
    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate))
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    });
  }

  render() {

    return (
      <div>
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.localVideoref }
          autoPlay muted>
        </video>
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.remoteVideoref }
          autoPlay>
        </video>
        <br />

        <button onClick={this.sendPreOffer}>PreOffer</button>
        <button onClick={this.createOffer}>Offer</button>
        <button onClick={this.createAnswer}>Answer</button>

        <br />
        <textarea style={{ width: 450, height:40 }} ref={ref => { this.textref = ref }} />

        {/* <br />
        <button onClick={this.setRemoteDescription}>Set Remote Desc</button>
        <button onClick={this.addCandidate}>Add Candidate</button> */}
      </div>
    )
  }
}

export default App;