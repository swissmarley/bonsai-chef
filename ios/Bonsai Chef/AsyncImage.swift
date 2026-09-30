//
//  AsyncImage.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 16.06.2024.
//

import SwiftUI
import UIKit

struct AsyncImage: View {
    let imagePath: String
    
    var body: some View {
        if let uiImage = loadImageFromDisk(with: imagePath) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
                .frame(width: 100, height: 100)
                .clipped()
        } else {
            Color.gray
                .frame(width: 100, height: 100)
        }
    }
    
    private func loadImageFromDisk(with filename: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(filename)
        guard let imageData = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: imageData)
    }
    

    func getDocumentsDirectory() -> URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0]
    }

    func saveImageToDocumentDirectory(_ image: UIImage, fileName: String) -> String? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
        if let data = image.jpegData(compressionQuality: 0.8) {
            do {
                try data.write(to: fileURL)
                return fileName
            } catch {
                print("Failed to save image to document directory: \(error)")
                return nil
            }
        }
        return nil
    }
    }
