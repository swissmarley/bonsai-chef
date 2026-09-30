//
//  ImageFullScreenView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 11.06.2024.
//

import SwiftUI

struct ImageFullScreenView: View {
  let images: [UIImage]
  @Binding var isPresented: Bool

  var body: some View {
    VStack {
      Spacer()
      TabView {
        ForEach(images, id: \.self) { image in
          Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .padding()
        }
      }
      .tabViewStyle(PageTabViewStyle())
      Spacer()
      Button("Chiudi") {
        isPresented = false // Dismiss the view by updating the binding
      }
      .padding()
      .background(Color.white)
      .cornerRadius(10)
    }
    .background(Color.black.opacity(0.8))
    .edgesIgnoringSafeArea(.all)
  }
}



